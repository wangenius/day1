import { room_manager } from "./GameRoomManager.js";
import { Player as PlayerEntity } from "./Player.js";
import { GameState, MessageType, RoleEnum } from "./types/types.js";
import { GameRoom } from "./GameRoom.js";
import { logger } from "./utils/logger.js";

function timeout(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class GameHandler {
  static ROUND_ACTION_TIMEOUT_SECONDS = 180;
  private static _round_timeout_tasks: Map<string, NodeJS.Timeout> = new Map();
  private static _round_tick_tasks: Map<string, NodeJS.Timeout> = new Map();

  private static _taskKey(room_id: string, round: number) {
    return `${room_id}:${round}`;
  }

  private static _cancelRoundTimeout(room_id: string, round: number) {
    const key = GameHandler._taskKey(room_id, round);
    const t = GameHandler._round_timeout_tasks.get(key);
    if (t) clearTimeout(t);
    GameHandler._round_timeout_tasks.delete(key);
  }

  private static _startRoundTick(room_id: string) {
    const existed = GameHandler._round_tick_tasks.get(room_id);
    if (existed) clearInterval(existed);
    const timer = setInterval(async () => {
      try {
        const room = room_manager.get_room(room_id);
        if (!room || room.game_state !== GameState.PLAYING)
          return clearInterval(timer);
        if (room.current_phase && typeof room.phase_remain === "number")
          room.phase_remain = Math.max(room.phase_remain - 1, 0);
        const current_round = room.current_round;
        const payload = {
          type: MessageType.ROUND_TICK,
          data: {
            round: current_round,
            phase: room.current_phase,
            remaining: room.phase_remain,
            roundEvent: room.round_events[current_round],
            privateMessages: room.round_private_messages[current_round],
            playerActions: room.round_actions[current_round] || [],
            waitingForPlayers:
              !room.all_players_submitted_actions(current_round),
            players: room.players.map((p) => ({
              name: p.name,
              is_online: p.is_online,
              role: p.role || null,
              isHost: p.is_host,
            })),
          },
        };
        if (room) await room.broadcast(payload);
        if (
          room.current_phase === "discussion" &&
          room.phase_remain === 0 &&
          !room.all_players_submitted_actions(current_round)
        ) {
          // auto submit for missing players
          const eventObj = room.round_events[current_round] || ({} as any);
          const option_keys = Object.keys(
            eventObj.decision_options || { A: "A", B: "B", C: "C" }
          );
          const online = room.get_online_players();
          const submitted = new Set(
            (room.round_actions[current_round] || []).map(
              (a: any) => a.playerName
            )
          );
          for (const p of online) {
            if (!submitted.has(p.name)) {
              const choice =
                option_keys[Math.floor(Math.random() * option_keys.length)] ||
                "A";
              await GameHandler.handle_game_action(p.name, {
                action: choice,
                reason: "phase_end_auto",
              });
            }
          }
        }
      } catch (e) {
        logger.error("[TICK] error:", (e as any)?.message || e);
        clearInterval(timer);
      }
    }, 1000);
    GameHandler._round_tick_tasks.set(room_id, timer);
  }

  static async handle_startup_idea(player_name: string, idea: string) {
    const room = room_manager.find_room_by_player(player_name);
    if (!room) return;
    const room_id = room.room_id;
    const player = room.get_player(player_name);
    if (!player) return;
    player.startup_idea = idea;
    await room.broadcast({
      type: MessageType.PLAYER_JOIN,
      data: {
        player_name: player_name,
        players: room.players.map((p) => ({
          name: p.name,
          is_online: p.is_online,
          startup_idea: p.startup_idea,
          role: p.role || null,
          isHost: p.is_host,
        })),
      },
    });
    if (room.all_players_have_ideas()) {
      room.startup_idea = room.get_online_players()[0]?.startup_idea || null;
      await room.broadcast({
        type: MessageType.IDEAS_COMPLETE,
        data: {
          startup_idea: room.startup_idea,
          players: room.players.map((p) => ({
            name: p.name,
            is_online: p.is_online,
            startup_idea: p.startup_idea,
            role: p.role || null,
            isHost: p.is_host,
          })),
        },
      });
    }
  }

  static async handle_start_game(player_name: string) {
    const room = room_manager.find_room_by_player(player_name);
    if (!room) return;
    const room_id = room.room_id;
    const player = room.get_player(player_name);
    if (!player || !player.is_host) return;
    if (room.game_state !== GameState.LOBBY) return;
    await room.broadcast({
      type: MessageType.GAME_LOADING,
      data: { message: "AI正在生成游戏背景，请稍候..." },
    });
    const ideas = room
      .get_online_players()
      .map((p) => p.startup_idea!)
      .filter(Boolean);
    try {
      room.background = await room.generate_background_from_ideas(ideas);
    } catch {
      room.background = "创业团队正在开始他们的创业之旅...";
    }
    try {
      const generated = await room.generate_roles_from_background(
        room.background || ""
      );
      const dynamic_roles: Record<string, any> = {};
      for (const [k, v] of Object.entries(generated)) {
        dynamic_roles[k] = {
          name: (v as any).name,
          description: (v as any).description,
          actions: (v as any).actions || [],
        };
      }
      room.dynamic_roles = dynamic_roles;
    } catch {
      room.dynamic_roles = {} as any;
    }
    room.game_state = GameState.ROLE_SELECTION;
    await room.broadcast({
      type: MessageType.GAME_START,
      data: {
        startup_idea: room.startup_idea,
        background: room.background,
        roles: room.dynamic_roles,
      },
    });
  }

  static async handle_role_selection(player_name: string, role: string) {
    const room = room_manager.find_room_by_player(player_name);
    if (!room) return;
    const room_id = room.room_id;

    const player = room.get_player(player_name);
    if (!player) return;
    if (player.role) {
      await room.send_to_player(player_name, {
        type: "role_selection_error",
        data: { message: "你已经选择过角色了" },
      });
      return;
    }
    if (!Object.values(RoleEnum).includes(role as RoleEnum)) {
      await room.send_to_player(player_name, {
        type: "role_selection_error",
        data: { message: `无效的角色: ${role}` },
      });
      return;
    }
    for (const p of room.get_online_players()) {
      if (p.name !== player_name && p.role === (role as RoleEnum)) {
        await room.send_to_player(player_name, {
          type: "role_selection_error",
          data: { message: `角色 ${role} 已被其他玩家选择，请选择其他角色` },
        });
        return;
      }
    }
    player.role = role as RoleEnum;
    await room.broadcast({
      type: MessageType.ROLE_SELECTED,
      data: {
        selectedRoles: room.get_selected_roles(),
        players: room.players.map((p) => ({
          name: p.name,
          is_online: p.is_online,
          role: p.role || null,
          startup_idea: p.startup_idea,
          isHost: p.is_host,
        })),
      },
    });
    if (room.all_players_have_roles()) {
      await GameHandler._auto_start_game_after_role_selection(room_id);
    }
  }

  private static async _auto_start_game_after_role_selection(room_id: string) {
    const room = room_manager.get_room(room_id);
    if (!room) return;
    room.game_state = GameState.LOADING;
    await room.broadcast({
      type: MessageType.GAME_LOADING,
      data: { message: "AI正在生成游戏背景和角色介绍，请稍候..." },
    });
    if (!room.background) {
      const ideas = room
        .get_online_players()
        .map((p) => p.startup_idea!)
        .filter(Boolean);
      try {
        room.background = await room.generate_background_from_ideas(ideas);
      } catch {
        room.background = "创业团队正在开始他们的创业之旅...";
      }
    }
    if (!room.dynamic_roles) {
      try {
        const generated = await room.generate_roles_from_background(
          room.background || ""
        );
        const dynamic_roles: Record<string, any> = {};
        for (const [k, v] of Object.entries(generated))
          dynamic_roles[k] = {
            name: (v as any).name,
            description: (v as any).description,
            actions: (v as any).actions || [],
          };
        room.dynamic_roles = dynamic_roles;
      } catch {
        room.dynamic_roles = {} as any;
      }
    }
    await room.broadcast({
      type: MessageType.GAME_START,
      data: {
        startup_idea: room.startup_idea,
        background: room.background,
        roles: room.dynamic_roles,
      },
    });
    room.current_round = 1;
    await room.broadcast({
      type: MessageType.ROUND_LOADING,
      data: { round: 1, message: "AI正在生成第1轮事件，请稍候..." },
    });
    const event = await room.generate_event(1);
    room.round_events[1] = event.event;
    room.round_private_messages[1] = event.private_messages;
    if (event.situation) room.round_situation[1] = event.situation;
    room.game_state = GameState.PLAYING;
    await room.broadcast({
      type: MessageType.GAME_STARTED,
      data: {
        round: 1,
        roundEvent: room.round_events[1],
        privateMessages: room.round_private_messages[1],
        isDefaultEvent: !!event.is_default_event,
      },
    });
    // phases
    room.set_phase("event_display", 180);
    await room.broadcast({
      type: MessageType.ROUND_PHASE,
      data: { phase: "event_display", round: 1 },
    });
    setTimeout(async () => {
      const r = room_manager.get_room(room_id);
      if (!r || r.current_round !== 1 || r.game_state !== GameState.PLAYING)
        return;
      if (r.current_phase !== "event_display") return;
      r.set_phase("info_and_options", r.phase_remain);
      await room.broadcast({
        type: MessageType.ROUND_PHASE,
        data: { phase: "info_and_options", round: 1 },
      });
    }, 10000);
    setTimeout(async () => {
      const r = room_manager.get_room(room_id);
      if (!r || r.current_round !== 1 || r.game_state !== GameState.PLAYING)
        return;
      if (r.current_phase !== "info_and_options") return;
      r.set_phase("discussion", r.phase_remain);
      await room.broadcast({
        type: MessageType.ROUND_PHASE,
        data: { phase: "discussion", round: 1 },
      });
    }, 30000);
    GameHandler._startRoundTick(room_id);
    // timeout auto submit
    const key = GameHandler._taskKey(room_id, 1);
    GameHandler._cancelRoundTimeout(room_id, 1);
    GameHandler._round_timeout_tasks.set(
      key,
      setTimeout(
        () =>
          GameHandler._auto_submit_after_timeout(
            room_id,
            1,
            GameHandler.ROUND_ACTION_TIMEOUT_SECONDS
          ),
        GameHandler.ROUND_ACTION_TIMEOUT_SECONDS * 1000
      )
    );
  }

  static async handle_game_action(player_name: string, action_data: any) {
    const room = room_manager.find_room_by_player(player_name);
    if (!room || room.game_state !== GameState.PLAYING) return;
    const room_id = room.room_id;
    const player = room.get_player(player_name);
    if (!player) return;
    const action = {
      playerName: player_name,
      actionType: "decision",
      action: action_data?.action,
      round: room.current_round,
      role: player.role,
      reason: action_data?.reason,
      timestamp: new Date().toISOString(),
    };
    room.add_round_action(room.current_round, action);
    await room.broadcast({
      type: MessageType.ACTION_SUBMITTED,
      data: {
        playerActions: room.round_actions[room.current_round] || [],
        waitingForPlayers: !room.all_players_submitted_actions(
          room.current_round
        ),
      },
    });
    if (room.all_players_submitted_actions(room.current_round)) {
      GameHandler._cancelRoundTimeout(room_id, room.current_round);
      await GameHandler._handle_round_complete(room_id, room);
    }
  }

  private static async _handle_round_complete(room_id: string, room: GameRoom) {
    if (room.current_round >= 5)
      await GameHandler._handle_game_complete(room_id, room);
    else await GameHandler._start_next_round(room_id, room);
  }

  private static async _handle_game_complete(room_id: string, room: GameRoom) {
    room.game_state = GameState.LOADING;
    await room.broadcast({
      type: MessageType.GAME_LOADING,
      data: { message: "AI正在分析游戏结果，请稍候..." },
    });
    try {
      if (room.current_round >= 1 && !room.round_situation[room.current_round])
        await room.generate_round_analysis(room.current_round + 1);
    } catch {}
    room.game_state = GameState.FINISHED;
    room.game_result = room.calculate_game_result();
    await room.broadcast({
      type: MessageType.GAME_COMPLETE,
      data: { result: room.game_result },
    });
  }

  private static async _start_next_round(room_id: string, room: GameRoom) {
    room.current_round += 1;
    room.game_state = GameState.LOADING;
    await room.broadcast({
      type: MessageType.ROUND_LOADING,
      data: {
        round: room.current_round,
        message: `AI正在生成第${room.current_round}轮事件，请稍候...`,
      },
    });
    if (room.current_round > 1) {
      try {
        await room.generate_round_analysis(room.current_round);
      } catch {}
    }
    const event = await room.generate_event(room.current_round);
    room.round_events[room.current_round] = event.event;
    room.round_private_messages[room.current_round] = event.private_messages;
    if (event.situation)
      room.round_situation[room.current_round] = event.situation;
    room.game_state = GameState.PLAYING;
    await room.broadcast({
      type: MessageType.ROUND_START,
      data: {
        round: room.current_round,
        roundInfo: room.get_round_info(room.current_round),
        roundEvent: room.round_events[room.current_round],
        privateMessages: room.round_private_messages[room.current_round],
        isDefaultEvent: !!event.is_default_event,
      },
    });
    // phases
    room.set_phase("event_display", 180);
    await room.broadcast({
      type: MessageType.ROUND_PHASE,
      data: { phase: "event_display", round: room.current_round },
    });
    setTimeout(async () => {
      const r = room_manager.get_room(room_id);
      if (
        !r ||
        r.current_round !== room.current_round ||
        r.game_state !== GameState.PLAYING
      )
        return;
      if (r.current_phase !== "event_display") return;
      r.set_phase("info_and_options", r.phase_remain);
      await room.broadcast({
        type: MessageType.ROUND_PHASE,
        data: { phase: "info_and_options", round: r.current_round },
      });
    }, 10000);
    setTimeout(async () => {
      const r = room_manager.get_room(room_id);
      if (
        !r ||
        r.current_round !== room.current_round ||
        r.game_state !== GameState.PLAYING
      )
        return;
      if (r.current_phase !== "info_and_options") return;
      r.set_phase("discussion", r.phase_remain);
      await room.broadcast({
        type: MessageType.ROUND_PHASE,
        data: { phase: "discussion", round: r.current_round },
      });
    }, 30000);
    GameHandler._startRoundTick(room_id);
    const key = GameHandler._taskKey(room_id, room.current_round);
    GameHandler._cancelRoundTimeout(room_id, room.current_round);
    GameHandler._round_timeout_tasks.set(
      key,
      setTimeout(
        () =>
          GameHandler._auto_submit_after_timeout(
            room_id,
            room.current_round,
            GameHandler.ROUND_ACTION_TIMEOUT_SECONDS
          ),
        GameHandler.ROUND_ACTION_TIMEOUT_SECONDS * 1000
      )
    );
  }

  static async handle_restart_game(player_name: string) {
    const room = room_manager.find_room_by_player(player_name);
    if (!room) return;
    const room_id = room.room_id;
    const player = room.get_player(player_name);
    if (!player || !player.is_host) return;
    room.game_state = GameState.LOBBY;
    room.current_round = 1;
    room.background = null;
    room.dynamic_roles = null;
    room.game_result = null;
    room.round_actions = {};
    room.round_events = {};
    room.round_private_messages = {};
    room.dynamic_round_info = {};
    room.round_situation = {};
    for (const p of room.players) {
      p.role = null as any;
      p.actions = [];
    }
    await room.broadcast({
      type: MessageType.GAME_RESTART,
      data: {
        players: room.players.map((p) => ({
          name: p.name,
          is_online: p.is_online,
          role: p.role || null,
          startup_idea: p.startup_idea,
          isHost: p.is_host,
        })),
      },
    });
  }

  private static async _auto_submit_after_timeout(
    room_id: string,
    round_num: number,
    timeout_seconds: number
  ) {
    await timeout(timeout_seconds * 1000);
    const room = room_manager.get_room(room_id);
    if (!room) return;
    if (
      room.current_round !== round_num ||
      room.game_state !== GameState.PLAYING
    )
      return;
    if (room.all_players_submitted_actions(round_num)) return;
    const ev = room.round_events[round_num] || ({} as any);
    const option_keys = Object.keys(
      ev.decision_options || { A: "A", B: "B", C: "C" }
    );
    const online = room.get_online_players();
    const submitted = new Set(
      (room.round_actions[round_num] || []).map((a: any) => a.playerName)
    );
    for (const p of online) {
      if (!submitted.has(p.name)) {
        const choice =
          option_keys[Math.floor(Math.random() * option_keys.length)] || "A";
        await GameHandler.handle_game_action(p.name, {
          action: choice,
          reason: "timeout_auto",
        });
      }
    }
  }
}

export const game_handler = GameHandler;
