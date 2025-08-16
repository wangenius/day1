import {
  GameState,
  MessageType,
  RoleEnum,
  DecisionEvent,
  GeneratedEvent,
} from "./types/types.js";
import { Room } from "./Room.js";
import { logger } from "./utils/logger.js";
import { LLM } from "./utils/llm.js";
import fs from "node:fs";
import path from "node:path";

const promptDir = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "prompt"
);
const readPrompt = (name: string) =>
  fs.readFileSync(path.join(promptDir, name), "utf-8");

const ROLE_PROMPT = readPrompt("role_generation.txt");
const P1 = readPrompt("prompt1.txt");
const P2 = readPrompt("prompt2.txt");
const P3 = readPrompt("prompt3.txt");
const P4 = readPrompt("prompt4.txt");

function timeout(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// 每房间的对局运行时状态
type RuntimeState = {
  current_round: number;
  background: string;
  dynamic_roles: Record<
    string,
    { name: string; description: string; actions?: string[] }
  > | null;
  game_result: any | null;
  round_events: Record<number, DecisionEvent>;
  round_private_messages: Record<number, Record<string, string>>;
  dynamic_round_info: Record<number, string>;
  round_situation: Record<number, string | Record<string, unknown>>;
  current_phase: "event_display" | "info_and_options" | "discussion" | null;
  phase_remain: number;
  round_actions: Record<number, Array<Record<string, any>>>;
};

function createDefaultState(): RuntimeState {
  return {
    current_round: 1,
    background: "",
    dynamic_roles: null,
    game_result: null,
    round_events: {},
    round_private_messages: {},
    dynamic_round_info: {},
    round_situation: {},
    current_phase: null,
    phase_remain: 180,
    round_actions: {},
  };
}

/**
 * 游戏处理类
 * 负责游戏逻辑的实现
 * 包括游戏状态的维护、事件的生成、玩家的行动处理等
 */
export class Game {
  // 轮次行动超时时间（秒）
  static ROUND_ACTION_TIMEOUT_SECONDS = 180;

  // 轮次行动超时任务
  private static _round_timeout_tasks: Map<string, NodeJS.Timeout> = new Map();

  // 轮次计时任务
  private static _round_tick_tasks: Map<string, NodeJS.Timeout> = new Map();

  // 每房间运行时状态
  private static _runtime: Map<string, RuntimeState> = new Map();

  private static _getState(room_id: string) {
    if (!Game._runtime.has(room_id))
      Game._runtime.set(room_id, createDefaultState());
    return Game._runtime.get(room_id)!;
  }

  // 任务键生成
  private static _taskKey(room_id: string, round: number) {
    return `${room_id}:${round}`;
  }

  // -------------------- 生成/分析逻辑（从 Room 迁移至此） --------------------
  private static _buildPreviousExperience(room: Room, upToRound: number) {
    const state = Game._getState(room.id);
    if (upToRound <= 1) return "";
    const parts: string[] = [];
    for (let r = 1; r < upToRound; r++) {
      let eventText = "暂无事件";
      const eventObj = state.round_events[r];
      if (eventObj) {
        const title =
          (eventObj as any).event_title || (eventObj as any).title || "";
        const desc =
          (eventObj as any).event_description ||
          (eventObj as any).description ||
          "";
        eventText = `${title} - ${desc}`.replace(/ -$/, "");
      }
      const normalize = (val: any) =>
        val == null
          ? ""
          : typeof val === "object"
          ? String((val as any).impact || val)
          : String(val);
      let resultText = "暂无结果";
      if (state.round_situation[r + 1])
        resultText = normalize(state.round_situation[r + 1]);
      else if (state.round_situation[r])
        resultText = normalize(state.round_situation[r]);
      parts.push(`第${r}轮事件：${eventText}\n第${r}轮结果：${resultText}`);
    }
    return parts.join("\n\n");
  }

  private static _validateEventResponse(resp: any) {
    if (typeof resp !== "object" || !resp) return false;
    if (!resp.event || typeof resp.event !== "object") return false;
    const e = resp.event;
    if (
      !("event_title" in e) ||
      !("event_description" in e) ||
      !("decision_options" in e)
    )
      return false;
    if (!resp.private_messages || typeof resp.private_messages !== "object")
      return false;
    for (const role of ["CEO", "CTO", "CMO", "COO"])
      if (!(role in resp.private_messages)) return false;
    return true;
  }

  private static _getDefaultEvent(round_num: number): GeneratedEvent {
    const default_events: Record<number, DecisionEvent> = {
      1: {
        event_title: "团队组建挑战",
        event_description:
          "创业初期，团队需要明确职责与合作方式，迎来第一个团队决策。",
        decision_options: {
          A: "立即制定详细分工与流程",
          B: "保持灵活、边做边改",
          C: "优先建立团队文化共识",
        },
      },
      2: {
        event_title: "产品开发方向",
        event_description: "产品概念已定，需要决定开发优先级与技术路线。",
        decision_options: {
          A: "专注核心功能做MVP",
          B: "全面开发功能完整",
          C: "重点研发创新技术",
        },
      },
      3: {
        event_title: "市场进入策略",
        event_description: "产品将近完成，制定市场推广与获客策略。",
        decision_options: {
          A: "大规模营销快速占领",
          B: "精准定位稳步推进",
          C: "小范围测试后调整",
        },
      },
      4: {
        event_title: "融资决策",
        event_description: "关键阶段，面临融资与股权选择。",
        decision_options: {
          A: "寻求VC加速发展",
          B: "自主发展控股权稀释",
          C: "找战略投资者获资源",
        },
      },
      5: {
        event_title: "规模化挑战",
        event_description: "业务增长，如何应对规模化挑战。",
        decision_options: {
          A: "扩张团队与规模",
          B: "优化流程提效率",
          C: "多元化拓展新线",
        },
      },
    };
    const event = default_events[round_num] || default_events[5];
    const pm = {
      CEO: `第${round_num}轮：权衡各方并做最终决策。`,
      CTO: `第${round_num}轮：从技术角度评估选项。`,
      CMO: `第${round_num}轮：关注市场反应与品牌影响。`,
      COO: `第${round_num}轮：关注成本与效率影响。`,
    } as Record<string, string>;
    return {
      situation: `第${round_num}轮：公司进入新阶段，面临重要决策。`,
      event,
      private_messages: pm,
      is_default_event: true,
    };
  }

  // 基础辅助（同原 Room 上的方法）
  private static _allPlayersSubmitted(room: Room, round_num: number) {
    const state = Game._getState(room.id);
    const online = room.get_online_players();
    const submitted = new Set<string>();
    const arr = state.round_actions[round_num] || [];
    arr.forEach((a) => submitted.add((a as any)?.playerName));
    return submitted.size === online.length;
  }

  private static _addRoundAction(
    room: Room,
    round_num: number,
    action: Record<string, any>
  ) {
    const state = Game._getState(room.id);
    if (!state.round_actions[round_num]) state.round_actions[round_num] = [];
    state.round_actions[round_num] = state.round_actions[round_num].filter(
      (a) => (a as any)?.playerName !== (action as any)?.playerName
    );
    state.round_actions[round_num].push(action);
  }

  private static _getRoundInfo(room: Room, round_num: number) {
    const state = Game._getState(room.id);
    if (state.dynamic_round_info[round_num])
      return state.dynamic_round_info[round_num];
    return "";
  }

  private static _setPhase(
    room: Room,
    phase: RuntimeState["current_phase"],
    remain: number
  ) {
    const state = Game._getState(room.id);
    state.current_phase = phase;
    state.phase_remain = remain;
  }

  /**
   * 游戏处理类主体
   */
  static async generateBackgroundFromIdeas(room: Room, playerIdeas: string[]) {
    if (!playerIdeas || playerIdeas.length === 0)
      throw new Error("没有玩家想法");
    const combined = playerIdeas
      .filter(Boolean)
      .map((i) => `- ${i}`)
      .join("\n");
    let prompt = P1.replace("{initial_idea}", combined);
    const playersInfo = room
      .get_online_players()
      .map((p) => `${p.name}(${p.role || "未选择角色"})`)
      .join("、");
    prompt = prompt.replace("{players}", playersInfo);
    const state = Game._getState(room.id);
    state.background = await new LLM().text(prompt, { temperature: 0.7 });
    return state.background;
  }

  static async generateRolesFromBackground(background: string) {
    if (!background) throw new Error("背景故事不能为空");
    const prompt = ROLE_PROMPT.replace("{background}", background);
    const defs = (await new LLM().json(prompt, { temperature: 0.7 })) as Record<
      string,
      { name: string; description: string; actions?: string[] }
    >;
    return defs;
  }

  static async generateEvent(
    room: Room,
    round_num: number
  ): Promise<GeneratedEvent> {
    const state = Game._getState(room.id);
    let prompt = P2.replace("{background}", state.background || "");
    prompt = prompt.replace("{current_round}", String(round_num));
    const prev =
      Game._buildPreviousExperience(room, round_num) || "暂无之前经历";
    prompt = prompt.replace("{previous_experience}", prev);

    const llm = new LLM();
    for (let i = 0; i < 3; i++) {
      try {
        const json = (await llm.json(prompt, {
          temperature: 0.7,
        })) as unknown as GeneratedEvent;
        if (!Game._validateEventResponse(json))
          throw new Error("返回的JSON结构不完整");
        return {
          situation: json.situation || "",
          event: json.event,
          private_messages: json.private_messages,
          is_default_event: false,
        };
      } catch {
        // retry
      }
    }
    return Game._getDefaultEvent(round_num);
  }

  static async generateRoundAnalysis(room: Room, current_round: number) {
    const state = Game._getState(room.id);
    if (current_round <= 1) {
      state.round_situation[current_round] = "";
      return "";
    }
    const prev = current_round - 1;
    const previous_experience = Game._buildPreviousExperience(room, prev);
    let eventText = "";
    const e = state.round_events[prev];
    if (e) {
      const title = (e as any).event_title || (e as any).title || "";
      const desc = (e as any).event_description || (e as any).description || "";
      eventText = `${title} - ${desc}`.replace(/ -$/, "");
    }
    const getChoice = (role: RoleEnum) => {
      const actions = state.round_actions[prev] || [];
      const found = actions.find((a) => (a as any).role === role);
      return (found as any)?.action || "";
    };
    let prompt = P3;
    prompt = prompt.replace("{background}", state.background || "");
    prompt = prompt.replace("{previous_experience}", previous_experience || "");
    prompt = prompt.replace("{event}", eventText);
    prompt = prompt.replace("{ceo_choice}", getChoice(RoleEnum.CEO));
    prompt = prompt.replace("{cto_choice}", getChoice(RoleEnum.CTO));
    prompt = prompt.replace("{coo_choice}", getChoice(RoleEnum.COO));
    prompt = prompt.replace("{cmo_choice}", getChoice(RoleEnum.CMO));
    let analysis = "";
    try {
      analysis = await new LLM().text(prompt, { temperature: 0.7 });
    } catch (e) {
      analysis = `第${prev}轮选择产生的影响：数据不足或生成失败。`;
    }
    state.round_situation[current_round] = analysis;
    return analysis;
  }

  static generateFinalReport(room: Room) {
    const state = Game._getState(room.id);
    const outputs: string[] = [];
    for (let round = 1; round <= 5; round++) {
      const parts: string[] = [];
      const sit = state.round_situation[round];
      if (sit)
        parts.push(
          `第${round}轮情况：${
            typeof sit === "object"
              ? String((sit as any).impact || sit)
              : String(sit)
          }`
        );
      const ev = state.round_events[round];
      if (ev) {
        const title = (ev as any).event_title || (ev as any).title || "";
        const desc =
          (ev as any).event_description || (ev as any).description || "";
        parts.push(`事件：${`${title} - ${desc}`.replace(/ -$/, "")}`);
      }
      const actions = state.round_actions[round] || [];
      if (actions.length) {
        const summary = actions
          .map(
            (a) =>
              `${(a as any).playerName || (a as any).player}(${String(
                ((a as any).role as any)?.toString?.() || (a as any).role || ""
              )})：${(a as any).action || ""}`
          )
          .join("\n");
        parts.push(`玩家决策：\n${summary}`);
      }
      outputs.push(parts.length ? parts.join("\n") : `第${round}轮：暂无数据`);
    }
    let prompt = P4.replace("{background}", state.background || "");
    prompt = prompt.replace("{output1}", outputs[0] || "暂无数据");
    prompt = prompt.replace("{output2}", outputs[1] || "暂无数据");
    prompt = prompt.replace("{output3}", outputs[2] || "暂无数据");
    prompt = prompt.replace("{output4}", outputs[3] || "暂无数据");
    prompt = prompt.replace("{output5}", outputs[4] || "暂无数据");
    const ceo = room.players.find((p) => p.role === RoleEnum.CEO);
    if (ceo)
      prompt = prompt.replace(
        "CEO/Founder：[玩家姓名]",
        `CEO/Founder：${ceo.name}`
      );
    const map: Record<RoleEnum, string> = {
      [RoleEnum.CTO]: "CTO",
      [RoleEnum.CMO]: "CMO",
      [RoleEnum.COO]: "COO",
      [RoleEnum.CEO]: "CEO",
    } as any;
    for (const p of room.players)
      if (p.role && p.role !== RoleEnum.CEO)
        prompt = prompt.replace(
          `${map[p.role]}：[玩家姓名]`,
          `${map[p.role]}：${p.name}`
        );
    const overall = Game._buildPreviousExperience(room, 6) || "暂无之前经历";
    prompt = prompt.replace("{previous_experience}", overall);
    return new LLM().text(prompt, { temperature: 0.7 }) as unknown as string;
  }

  static calculateGameResult(room: Room) {
    const state = Game._getState(room.id);
    const base_score = 50;
    const user_growth = Game._randInt(1000, 100000);
    const revenue = Game._randInt(10000, 1000000);
    const market_share = Game._randInt(1, 25);
    const team_size = Game._randInt(5, 100);
    const total_actions = Object.values(state.round_actions).reduce(
      (s, arr) => s + arr.length,
      0
    );
    const score_bonus = Math.min(total_actions * 2, 50);
    const final_score = base_score + score_bonus;
    let success_level = "创业失败";
    if (final_score >= 90) success_level = "独角兽公司";
    else if (final_score >= 75) success_level = "成功上市";
    else if (final_score >= 60) success_level = "盈利稳定";
    else if (final_score >= 45) success_level = "勉强生存";
    const player_performance = Game._calculatePlayerPerformance(room);
    const playerScores: Record<string, number> = {};
    for (const perf of player_performance)
      playerScores[String((perf as any).player)] = Math.min(
        50 + Number((perf as any).contribution_score || 0),
        100
      );
    let final_report = "";
    try {
      final_report = Game.generateFinalReport(room) as unknown as string;
    } catch {
      final_report = "报告生成失败，请稍后重试。";
    }
    return {
      final_score,
      success_level,
      metrics: { user_growth, revenue, market_share, team_size },
      achievements: Game._generateAchievements(final_score),
      timeline: Game._generateTimeline(),
      player_performance,
      playerScores,
      final_report,
    };
  }

  private static _calculatePlayerPerformance(room: Room) {
    const state = Game._getState(room.id);
    const perf: Array<Record<string, any>> = [];
    for (const p of room.players) {
      const action_count = Object.values(state.round_actions).reduce(
        (s, arr) =>
          s +
          arr.filter((a: any) => a.player === p.name || a.playerName === p.name)
            .length,
        0
      );
      perf.push({
        player: p.name,
        role: p.role,
        actions_taken: action_count,
        contribution_score: Math.min(action_count * 10, 50),
      });
    }
    return perf;
  }

  private static _generateAchievements(score: number) {
    const a: string[] = [];
    if (score >= 90)
      a.push("🦄 独角兽成就", "💰 十亿美元估值", "🌟 行业领导者");
    else if (score >= 75)
      a.push("📈 成功IPO", "🏆 年度最佳创业公司", "🌍 国际化扩张");
    else if (score >= 60)
      a.push("💼 盈利达成", "👥 团队建设专家", "📊 市场份额突破");
    else if (score >= 45) a.push("🎯 产品上线", "💡 创新思维", "🤝 团队协作");
    return a;
  }

  private static _generateTimeline() {
    return [
      { round: 1, event: "产品原型开发完成", impact: "positive" },
      { round: 2, event: "获得首批用户", impact: "positive" },
      { round: 3, event: "完成A轮融资", impact: "positive" },
      { round: 4, event: "市场竞争加剧", impact: "negative" },
      { round: 5, event: "战略合作达成", impact: "positive" },
    ];
  }

  private static _randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private static _cancelRoundTimeout(room_id: string, round: number) {
    const key = Game._taskKey(room_id, round);
    const t = Game._round_timeout_tasks.get(key);
    if (t) clearTimeout(t);
    Game._round_timeout_tasks.delete(key);
  }

  private static _startRoundTick(room_id: string) {
    const existed = Game._round_tick_tasks.get(room_id);
    if (existed) clearInterval(existed);
    const timer = setInterval(async () => {
      try {
        const room = Room.get(room_id);
        if (!room || room.game_state !== GameState.PLAYING)
          return clearInterval(timer);
        const state = Game._getState(room_id);
        if (state.current_phase && typeof state.phase_remain === "number")
          state.phase_remain = Math.max(state.phase_remain - 1, 0);
        const current_round = state.current_round;
        const payload = {
          type: MessageType.ROUND_TICK,
          data: {
            round: current_round,
            phase: state.current_phase,
            remaining: state.phase_remain,
            roundEvent: state.round_events[current_round],
            privateMessages: state.round_private_messages[current_round],
            playerActions: state.round_actions[current_round] || [],
            waitingForPlayers: !Game._allPlayersSubmitted(room, current_round),
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
          state.current_phase === "discussion" &&
          state.phase_remain === 0 &&
          !Game._allPlayersSubmitted(room, current_round)
        ) {
          // auto submit for missing players
          const eventObj = state.round_events[current_round] || ({} as any);
          const option_keys = Object.keys(
            eventObj.decision_options || { A: "A", B: "B", C: "C" }
          );
          const online = room.get_online_players();
          const submitted = new Set(
            (state.round_actions[current_round] || []).map(
              (a: any) => a.playerName
            )
          );
          for (const p of online) {
            if (!submitted.has(p.name)) {
              const choice =
                option_keys[Math.floor(Math.random() * option_keys.length)] ||
                "A";
              await Game.handle_game_action(p.name, {
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
    Game._round_tick_tasks.set(room_id, timer);
  }

  static async handle_startup_idea(player_name: string, idea: string) {
    const room = Room.get_by_player(player_name);
    if (!room) return;
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
    const room = Room.get_by_player(player_name);
    if (!room) return;
    const room_id = room.id;
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
    const state = Game._getState(room_id);
    try {
      state.background = await Game.generateBackgroundFromIdeas(room, ideas);
    } catch {
      state.background = "创业团队正在开始他们的创业之旅...";
    }
    try {
      const generated = await Game.generateRolesFromBackground(
        state.background || ""
      );
      const dynamic_roles: Record<string, any> = {};
      for (const [k, v] of Object.entries(generated)) {
        dynamic_roles[k] = {
          name: (v as any).name,
          description: (v as any).description,
          actions: (v as any).actions || [],
        };
      }
      state.dynamic_roles = dynamic_roles;
    } catch {
      state.dynamic_roles = {} as any;
    }
    room.game_state = GameState.ROLE_SELECTION;
    await room.broadcast({
      type: MessageType.GAME_START,
      data: {
        startup_idea: room.startup_idea,
        background: state.background,
        roles: state.dynamic_roles,
      },
    });
  }

  static async handle_role_selection(player_name: string, role: string) {
    const room = Room.get_by_player(player_name);
    if (!room) return;
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
      await Game._auto_start_game_after_role_selection(room.id);
    }
  }

  private static async _auto_start_game_after_role_selection(room_id: string) {
    const room = Room.get(room_id);
    if (!room) return;
    const state = Game._getState(room_id);
    room.game_state = GameState.LOADING;
    await room.broadcast({
      type: MessageType.GAME_LOADING,
      data: { message: "AI正在生成游戏背景和角色介绍，请稍候..." },
    });
    if (!state.background) {
      const ideas = room
        .get_online_players()
        .map((p) => p.startup_idea!)
        .filter(Boolean);
      try {
        state.background = await Game.generateBackgroundFromIdeas(room, ideas);
      } catch {
        state.background = "创业团队正在开始他们的创业之旅...";
      }
    }
    if (!state.dynamic_roles) {
      try {
        const generated = await Game.generateRolesFromBackground(
          state.background || ""
        );
        const dynamic_roles: Record<string, any> = {};
        for (const [k, v] of Object.entries(generated))
          dynamic_roles[k] = {
            name: (v as any).name,
            description: (v as any).description,
            actions: (v as any).actions || [],
          };
        state.dynamic_roles = dynamic_roles;
      } catch {
        state.dynamic_roles = {} as any;
      }
    }
    await room.broadcast({
      type: MessageType.GAME_START,
      data: {
        startup_idea: room.startup_idea,
        background: state.background,
        roles: state.dynamic_roles,
      },
    });
    state.current_round = 1;
    await room.broadcast({
      type: MessageType.ROUND_LOADING,
      data: { round: 1, message: "AI正在生成第1轮事件，请稍候..." },
    });
    const event = await Game.generateEvent(room, 1);
    state.round_events[1] = event.event;
    state.round_private_messages[1] = event.private_messages;
    if (event.situation) state.round_situation[1] = event.situation;
    room.game_state = GameState.PLAYING;
    await room.broadcast({
      type: MessageType.GAME_STARTED,
      data: {
        round: 1,
        roundEvent: state.round_events[1],
        privateMessages: state.round_private_messages[1],
        isDefaultEvent: !!event.is_default_event,
      },
    });
    // phases
    Game._setPhase(room, "event_display", 180);
    await room.broadcast({
      type: MessageType.ROUND_PHASE,
      data: { phase: "event_display", round: 1 },
    });
    setTimeout(async () => {
      const r = Room.get(room_id);
      if (!r) return;
      const s = Game._getState(room_id);
      if (s.current_round !== 1 || r.game_state !== GameState.PLAYING) return;
      if (s.current_phase !== "event_display") return;
      Game._setPhase(r, "info_and_options", s.phase_remain);
      await r.broadcast({
        type: MessageType.ROUND_PHASE,
        data: { phase: "info_and_options", round: 1 },
      });
    }, 10000);
    setTimeout(async () => {
      const r = Room.get(room_id);
      if (!r) return;
      const s = Game._getState(room_id);
      if (s.current_round !== 1 || r.game_state !== GameState.PLAYING) return;
      if (s.current_phase !== "info_and_options") return;
      Game._setPhase(r, "discussion", s.phase_remain);
      await r.broadcast({
        type: MessageType.ROUND_PHASE,
        data: { phase: "discussion", round: 1 },
      });
    }, 30000);
    Game._startRoundTick(room_id);
    // timeout auto submit
    const key = Game._taskKey(room_id, 1);
    Game._cancelRoundTimeout(room_id, 1);
    Game._round_timeout_tasks.set(
      key,
      setTimeout(
        () =>
          Game._auto_submit_after_timeout(
            room_id,
            1,
            Game.ROUND_ACTION_TIMEOUT_SECONDS
          ),
        Game.ROUND_ACTION_TIMEOUT_SECONDS * 1000
      )
    );
  }

  static async handle_game_action(player_name: string, action_data: any) {
    const room = Room.get_by_player(player_name);
    if (!room || room.game_state !== GameState.PLAYING) return;
    const state = Game._getState(room.id);
    const action = {
      playerName: player_name,
      actionType: "decision",
      action: action_data?.action,
      round: state.current_round,
      role: room.get_player(player_name)?.role,
      reason: action_data?.reason,
      timestamp: new Date().toISOString(),
    };
    Game._addRoundAction(room, state.current_round, action);
    await room.broadcast({
      type: MessageType.ACTION_SUBMITTED,
      data: {
        playerActions: state.round_actions[state.current_round] || [],
        waitingForPlayers: !Game._allPlayersSubmitted(
          room,
          state.current_round
        ),
      },
    });
    if (Game._allPlayersSubmitted(room, state.current_round)) {
      Game._cancelRoundTimeout(room.id, state.current_round);
      await Game._handle_round_complete(room.id, room);
    }
  }

  private static async _handle_round_complete(room_id: string, room: Room) {
    const state = Game._getState(room_id);
    if (state.current_round >= 5)
      await Game._handle_game_complete(room_id, room);
    else await Game._start_next_round(room_id, room);
  }

  private static async _handle_game_complete(room_id: string, room: Room) {
    const state = Game._getState(room_id);
    room.game_state = GameState.LOADING;
    await room.broadcast({
      type: MessageType.GAME_LOADING,
      data: { message: "AI正在分析游戏结果，请稍候..." },
    });
    try {
      if (
        state.current_round >= 1 &&
        !state.round_situation[state.current_round]
      )
        await Game.generateRoundAnalysis(room, state.current_round + 1);
    } catch {}
    room.game_state = GameState.FINISHED;
    state.game_result = Game.calculateGameResult(room);
    await room.broadcast({
      type: MessageType.GAME_COMPLETE,
      data: { result: state.game_result },
    });
  }

  private static async _start_next_round(room_id: string, room: Room) {
    const state = Game._getState(room_id);
    state.current_round += 1;
    room.game_state = GameState.LOADING;
    await room.broadcast({
      type: MessageType.ROUND_LOADING,
      data: {
        round: state.current_round,
        message: `AI正在生成第${state.current_round}轮事件，请稍候...`,
      },
    });
    if (state.current_round > 1) {
      try {
        await Game.generateRoundAnalysis(room, state.current_round);
      } catch {}
    }
    const event = await Game.generateEvent(room, state.current_round);
    state.round_events[state.current_round] = event.event;
    state.round_private_messages[state.current_round] = event.private_messages;
    if (event.situation)
      state.round_situation[state.current_round] = event.situation;
    room.game_state = GameState.PLAYING;
    await room.broadcast({
      type: MessageType.ROUND_START,
      data: {
        round: state.current_round,
        roundInfo: Game._getRoundInfo(room, state.current_round),
        roundEvent: state.round_events[state.current_round],
        privateMessages: state.round_private_messages[state.current_round],
        isDefaultEvent: !!event.is_default_event,
      },
    });
    // phases
    Game._setPhase(room, "event_display", 180);
    await room.broadcast({
      type: MessageType.ROUND_PHASE,
      data: { phase: "event_display", round: state.current_round },
    });
    setTimeout(async () => {
      const r = Room.get(room_id);
      if (!r) return;
      const s = Game._getState(room_id);
      if (
        s.current_round !== state.current_round ||
        r.game_state !== GameState.PLAYING
      )
        return;
      if (s.current_phase !== "event_display") return;
      Game._setPhase(r, "info_and_options", s.phase_remain);
      await room.broadcast({
        type: MessageType.ROUND_PHASE,
        data: { phase: "info_and_options", round: s.current_round },
      });
    }, 10000);
    setTimeout(async () => {
      const r = Room.get(room_id);
      if (!r) return;
      const s = Game._getState(room_id);
      if (
        s.current_round !== state.current_round ||
        r.game_state !== GameState.PLAYING
      )
        return;
      if (s.current_phase !== "info_and_options") return;
      Game._setPhase(r, "discussion", s.phase_remain);
      await room.broadcast({
        type: MessageType.ROUND_PHASE,
        data: { phase: "discussion", round: s.current_round },
      });
    }, 30000);
    Game._startRoundTick(room_id);
    const key = Game._taskKey(room_id, state.current_round);
    Game._cancelRoundTimeout(room_id, state.current_round);
    Game._round_timeout_tasks.set(
      key,
      setTimeout(
        () =>
          Game._auto_submit_after_timeout(
            room_id,
            state.current_round,
            Game.ROUND_ACTION_TIMEOUT_SECONDS
          ),
        Game.ROUND_ACTION_TIMEOUT_SECONDS * 1000
      )
    );
  }

  static async handle_restart_game(player_name: string) {
    const room = Room.get_by_player(player_name);
    if (!room) return;
    const player = room.get_player(player_name);
    if (!player || !player.is_host) return;
    const state = Game._getState(room.id);
    room.game_state = GameState.LOBBY;
    state.current_round = 1;
    state.background = "";
    state.dynamic_roles = null;
    state.game_result = null;
    state.round_actions = {};
    state.round_events = {};
    state.round_private_messages = {};
    state.dynamic_round_info = {};
    state.round_situation = {};
    state.current_phase = null;
    state.phase_remain = 180;
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
    const room = Room.get(room_id);
    if (!room) return;
    const state = Game._getState(room_id);
    if (
      state.current_round !== round_num ||
      room.game_state !== GameState.PLAYING
    )
      return;
    if (Game._allPlayersSubmitted(room, round_num)) return;
    const ev = state.round_events[round_num] || ({} as any);
    const option_keys = Object.keys(
      ev.decision_options || { A: "A", B: "B", C: "C" }
    );
    const online = room.get_online_players();
    const submitted = new Set(
      (state.round_actions[round_num] || []).map((a: any) => a.playerName)
    );
    for (const p of online) {
      if (!submitted.has(p.name)) {
        const choice =
          option_keys[Math.floor(Math.random() * option_keys.length)] || "A";
        await Game.handle_game_action(p.name, {
          action: choice,
          reason: "timeout_auto",
        });
      }
    }
  }
}
