import type { WebSocket } from "ws";
import { room_manager } from "./GameRoomManager.js";
import { game_handler } from "./gameHandler.js";
import {
  MessageType,
  GameState,
  Player as PlayerType,
  RoleEnum,
} from "./types/types.js";

export class Player implements PlayerType {
  name: string = "";
  is_online: boolean = true;
  joined_at: string = new Date().toISOString();
  role: RoleEnum;
  startup_idea: string;
  is_host: boolean;
  actions: Array<Record<string, unknown>> = [];
  socket?: WebSocket;
  constructor(
    name: string,
    role: RoleEnum,
    startup_idea: string,
    is_host: boolean
  ) {
    this.name = name;
    this.role = role;
    this.startup_idea = startup_idea || "";
    this.is_host = is_host;
  }

  /**
   * 处理新的 WebSocket 连接
   */
  static async handle_connection(ws: WebSocket) {
    // 等待首条连接信息
    const init = await new Promise<string>((resolve, reject) => {
      const onMessage = (data: WebSocket.RawData) => {
        ws.off("message", onMessage);
        resolve(String(data));
      };
      ws.on("message", onMessage);
      ws.once("close", () => reject(new Error("closed")));
      ws.once("error", (e: Error) => reject(e));
    });
    const connect_data = JSON.parse(init || "{}");
    const player_name = connect_data?.player_name;
    const room_id = connect_data?.room_id;
    if (!player_name || !room_id) {
      ws.close(4000, "缺少玩家名称或房间ID");
      return;
    }
    const room = room_manager.get_room(room_id);
    if (!room) {
      ws.close(4004, `房间 ${room_id} 不存在`);
      return;
    }
    let player = room.get_player(player_name);
    let is_reconnect = false;
    if (!player) {
      try {
        room_manager.join_room(player_name, room_id);
        player = room.get_player(player_name);
        is_reconnect = false;
      } catch (e: any) {
        ws.close(4005, e?.message || "加入房间失败");
        return;
      }
    } else {
      player.is_online = true;
      is_reconnect = true;
    }
    // 绑定 socket 到 player
    (player as any).socket = ws;

    const payloadPlayers = room.players.map((p) => ({
      name: p.name,
      is_online: p.is_online,
      role: p.role || null,
      startup_idea: p.startup_idea,
      isHost: p.is_host,
    }));

    if (!is_reconnect) {
      await room.broadcast({
        type: MessageType.PLAYER_JOIN,
        data: { player_name, players: payloadPlayers },
      });
    } else {
      await room.broadcast(
        {
          type: MessageType.PLAYER_JOIN,
          data: { player_name, players: payloadPlayers },
        },
        player_name
      );
    }

    const connection_data = {
      type: MessageType.CONNECTION_SUCCESS,
      data: {
        room_id,
        player_name,
        is_reconnect,
        game_state: room.game_state,
        current_round: room.current_round,
        startup_idea: room.startup_idea,
        background: room.background,
        dynamic_roles: room.dynamic_roles,
        game_result: room.game_result,
        round_actions: room.round_actions,
        round_events: room.round_events,
        round_private_messages: room.round_private_messages,
        dynamic_round_info: room.dynamic_round_info,
        players: payloadPlayers,
        selected_roles: room.get_selected_roles(),
        round_info: room.get_round_info(room.current_round),
      },
    } as const;

    if (room.game_state === GameState.LOADING) {
      (
        connection_data as any
      ).data.loading_message = `AI正在生成第${room.current_round}轮事件，请稍候...`;
    } else if (room.game_state === GameState.PLAYING) {
      if (room.round_events[room.current_round])
        (connection_data as any).data.roundEvent =
          room.round_events[room.current_round];
      if (room.round_private_messages[room.current_round])
        (connection_data as any).data.privateMessages =
          room.round_private_messages[room.current_round];
      if (room.round_actions[room.current_round])
        (connection_data as any).data.player_actions =
          room.round_actions[room.current_round];
    }

    ws.send(JSON.stringify(connection_data));

    ws.on("message", async (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(String(raw) || "{}");
        const t = msg?.type;
        const data = msg?.data || {};
        if (t === "startup_idea")
          await game_handler.handle_startup_idea(player_name, data?.idea);
        else if (t === "start_game")
          await game_handler.handle_start_game(player_name);
        else if (t === "select_role")
          await game_handler.handle_role_selection(player_name, data?.role);
        else if (t === "game_action")
          await game_handler.handle_game_action(player_name, data);
        else if (t === "restart_game")
          await game_handler.handle_restart_game(player_name);
      } catch {}
    });

    ws.on("close", async () => {
      const r = room_manager.find_room_by_player(player_name);
      if (r) {
        const other_online = r
          .get_online_players()
          .filter((p) => p.name !== player_name);
        r.remove_player(player_name);
        if (other_online.length) {
          await r.broadcast({
            type: MessageType.PLAYER_LEAVE,
            data: {
              player_name,
              players: r.players.map((p) => ({
                name: p.name,
                is_online: p.is_online,
                role: p.role || null,
                startup_idea: p.startup_idea,
                isHost: p.is_host,
              })),
            },
          });
        }
        if (r.get_online_players().length === 0)
          room_manager.remove_room(r.room_id);
      }
      try {
        (player as any).socket = null;
      } catch {}
    });
  }
}

// 原 WebSocketHandler 的职责已合并到 Player.handle_connection
