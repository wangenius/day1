import {
  GameState,
  RoleEnum,
  RoomState,
  GameInfo,
  RoundInfo,
  GameResult,
} from "./types/types.js";
import { Room } from "./Room.js";
import { logger } from "./utils/logger.js";
import { LLM } from "./utils/llm.js";
import fs from "node:fs";
import path from "node:path";

/**
 * 游戏消息类型枚举
 * 
 * 定义了游戏过程中所有的状态变化和事件通知类型：
 * 
 * 连接相关：
 * - CONNECTION_SUCCESS: 连接成功
 * - PLAYER_JOIN/LEAVE: 玩家加入/离开
 * 
 * 游戏阶段：
 * - IDEAS_COMPLETE: 创业想法收集完成
 * - GAME_LOADING: 游戏加载中（AI生成背景）
 * - GAME_START: 游戏开始
 * - GAME_STARTED: 游戏正式开始（第一轮）
 * 
 * 角色相关：
 * - ROLE_SELECTED: 角色选择完成
 * 
 * 轮次相关：
 * - ROUND_LOADING: 轮次加载中（AI生成事件）
 * - ROUND_START: 轮次开始
 * - ROUND_PHASE: 轮次阶段切换
 * - ROUND_TICK: 轮次计时更新
 * - ACTION_SUBMITTED: 玩家行动提交
 * 
 * 游戏结束：
 * - GAME_COMPLETE: 游戏完成
 * - GAME_RESTART: 游戏重启
 */
enum MessageType {
  CONNECTION_SUCCESS = "connection_success",
  PLAYER_JOIN = "player_join",
  PLAYER_LEAVE = "player_leave",
  IDEAS_COMPLETE = "ideas_complete",
  GAME_LOADING = "game_loading",
  GAME_START = "game_start",
  GAME_STARTED = "game_started",
  ROLE_SELECTED = "role_selected",
  ROUND_LOADING = "round_loading",
  ROUND_START = "round_start",
  ROUND_PHASE = "round_phase",
  ROUND_TICK = "round_tick",
  ACTION_SUBMITTED = "action_submitted",
  GAME_COMPLETE = "game_complete",
  GAME_RESTART = "game_restart",
}

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

/**
 * AI生成事件的数据结构
 * 
 * 用于定义LLM生成的游戏事件格式：
 * - situation: 当前轮次的情况描述
 * - event: 具体的事件内容和决策选项
 * - private_messages: 每个角色的私密信息
 * - is_default_event: 是否为默认事件（AI生成失败时的兜底）
 */
interface GeneratedEvent {
  situation?: string;
  event: {
    event_title: string;
    event_description: string;
    decision_options: Record<string, string>;
  };
  private_messages: Record<string, string>;
  is_default_event?: boolean;
}

/**
 * 创建默认游戏信息对象
 * 
 * 初始化空的游戏状态，包含：
 * - 游戏状态设为PLAYING
 * - 空的结果报告
 * - 空的玩家想法和角色映射
 * - 空的背景故事和轮次数据
 * - 当前轮次设为1
 * 
 * @returns 初始化的游戏信息对象
 */
function createDefaultGameInfo(): GameInfo {
  return {
    state: GameState.PLAYING,
    result: { report: "" },
    ideas: {},           // 玩家名 -> 创业想法
    selected_idea: "",   // 选中的创业想法
    roles: {},           // 玩家名 -> 角色
    background: "",      // AI生成的背景故事
    rounds: {},          // 轮次号 -> 轮次信息
    current_round: 1,    // 当前轮次
  };
}

/**
 * 游戏逻辑核心类
 * 
 * 职责说明：
 * 1. 游戏流程控制：管理5轮游戏的完整生命周期
 * 2. AI内容生成：集成LLM生成动态游戏内容
 * 3. 计时和超时管理：自动推进游戏进程，处理超时情况
 * 4. 结果计算：评分系统、成就生成、个人表现分析
 * 5. 状态同步：实时向客户端广播游戏状态变化
 * 
 * 核心特性：
 * - 基于AI的动态内容生成系统
 * - 多层定时器确保游戏节奏
 * - 完善的超时和异常处理机制
 * - 支持断线重连的状态恢复
 * - 个性化角色体验和私密信息
 * 
 * 技术实现：
 * - 状态机模式控制游戏阶段
 * - 事件驱动的消息广播系统
 * - 基于Promise的异步AI调用
 * - 内存安全的定时器管理
 */
export class Game {
  /** 游戏状态数据 - 包含所有游戏相关信息 */
  gameInfo: GameInfo;
  
  /** 关联的房间实例 - 用于消息广播和玩家管理 */
  room: Room;

  /** 轮次行动超时时间（秒） - 玩家必须在此时间内提交行动 */
  static ROUND_ACTION_TIMEOUT_SECONDS = 180;

  /** 轮次行动超时任务管理器 - 使用房间ID:轮次号作为键 */
  private static _round_timeout_tasks: Map<string, NodeJS.Timeout> = new Map();

  /** 轮次计时任务管理器 - 每秒更新剩余时间并广播 */
  private static _round_tick_tasks: Map<string, NodeJS.Timeout> = new Map();

  /**
   * 构造函数 - 初始化游戏实例
   * 
   * @param room 关联的房间实例
   */
  constructor(room: Room) {
    this.room = room;
    this.gameInfo = createDefaultGameInfo();
  }
  private _taskKey(roomId: string, round: number) {
    return `${roomId}:${round}`;
  }
  private _buildPreviousExperience(upToRound: number) {
    const gameInfo = this.gameInfo;
    if (upToRound <= 1) return "";
    const parts: string[] = [];
    for (let r = 1; r < upToRound; r++) {
      const roundInfo = gameInfo.rounds[r];
      if (roundInfo) {
        const eventText = roundInfo.situation || "暂无事件";
        const actionsText = Object.entries(roundInfo.player_actions)
          .map(([player, action]) => `${player}: ${action}`)
          .join(", ");
        parts.push(
          `第${r}轮：${eventText}\n玩家决策：${actionsText || "暂无决策"}`
        );
      } else {
        parts.push(`第${r}轮：暂无数据`);
      }
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

  private _allPlayersSubmitted(round_num: number) {
    const roundInfo = this.gameInfo.rounds[round_num];
    if (!roundInfo) return false;
    const online = this.room.get_online_players();
    const submitted = Object.keys(roundInfo.player_actions);
    return submitted.length === online.length;
  }

  private _addRoundAction(
    round_num: number,
    player_name: string,
    action: string
  ) {
    const gameInfo = this.gameInfo;
    if (!gameInfo.rounds[round_num]) {
      gameInfo.rounds[round_num] = {
        situation: "",
        decision_options: {},
        private_messages: {},
        player_actions: {},
        phase_remain: 180,
      };
    }
    gameInfo.rounds[round_num].player_actions[player_name] = action;
  }

  private _getRoundInfo(round_num: number) {
    const roundInfo = this.gameInfo.rounds[round_num];
    return roundInfo?.situation || "";
  }

  private _setPhaseRemain(round_num: number, remain: number) {
    const roundInfo = this.gameInfo.rounds[round_num];
    if (roundInfo) {
      roundInfo.phase_remain = remain;
    }
  }

  // 统一：确保背景与角色已生成
  private async _ensureBackgroundAndRoles() {
    const gameInfo = this.gameInfo;

    // 注意：ideas 和 roles 应该已经通过 handle_startup_idea 和 handle_role_selection 方法设置了
    // 这里我们只需要确保背景已生成

    if (!gameInfo.background) {
      const ideas = Object.values(gameInfo.ideas);
      try {
        gameInfo.background = await this.generateBackgroundFromIdeas(ideas);
      } catch {
        gameInfo.background = "创业团队正在开始他们的创业之旅...";
      }
    }

    return gameInfo;
  }

  // 统一：生成并写入当轮事件数据
  private async _prepareRoundData(round_num: number) {
    const gameInfo = this.gameInfo;
    const event = await this.generateEvent(round_num);

    // 创建 RoundInfo
    const roundInfo: RoundInfo = {
      situation: event.situation || "",
      decision_options: event.event.decision_options,
      private_messages: event.private_messages,
      player_actions: {},
      phase_remain: 180,
    };

    gameInfo.rounds[round_num] = roundInfo;
    return event;
  }

  // 统一：到点为未提交玩家自动提交
  private async _autoSubmitMissingPlayers(round_num: number, reason: string) {
    const roundInfo = this.gameInfo.rounds[round_num];
    if (!roundInfo) return;

    const option_keys = Object.keys(roundInfo.decision_options);
    if (option_keys.length === 0) {
      option_keys.push("A", "B", "C");
    }

    const online = this.room.get_online_players();
    const submitted = new Set(Object.keys(roundInfo.player_actions));

    for (const p of online) {
      if (!submitted.has(p.name)) {
        const choice =
          option_keys[Math.floor(Math.random() * option_keys.length)] || "A";
        await this.handle_game_action(p.name, { action: choice, reason });
      }
    }
  }

  // 统一：安排阶段切换与tick
  private _schedulePhaseTransitions(expected_round: number) {
    setTimeout(async () => {
      const r = this.room;
      if (!r) return;
      const gameInfo = this.gameInfo;
      if (
        gameInfo.current_round !== expected_round ||
        r.state !== RoomState.PLAYING
      )
        return;
      await r.broadcast({
        type: MessageType.ROUND_PHASE,
        data: { phase: "info_and_options", round: expected_round },
      });
    }, 10000);
    setTimeout(async () => {
      const r = this.room;
      if (!r) return;
      const gameInfo = this.gameInfo;
      if (
        gameInfo.current_round !== expected_round ||
        r.state !== RoomState.PLAYING
      )
        return;
      await r.broadcast({
        type: MessageType.ROUND_PHASE,
        data: { phase: "discussion", round: expected_round },
      });
    }, 30000);
    this._startRoundTick();
  }

  /**
   * 基于玩家创业想法生成背景故事
   * 
   * 功能说明：
   * - 整合所有玩家的创业想法
   * - 使用AI生成统一的背景故事
   * - 结合玩家信息和角色设定
   * - 为后续事件生成提供上下文
   * 
   * AI Prompt策略：
   * - 使用P1模板（prompt1.txt）
   * - 替换占位符：{initial_idea}、{players}
   * - 设置适中的temperature(0.7)保证创意性
   * 
   * 错误处理：
   * - 输入验证：检查想法数组是否为空
   * - AI调用失败时抛出异常
   * 
   * @param playerIdeas 所有玩家的创业想法数组
   * @returns Promise<生成的背景故事>
   * @throws Error 当没有玩家想法或AI生成失败时
   */
  async generateBackgroundFromIdeas(playerIdeas: string[]) {
    if (!playerIdeas || playerIdeas.length === 0)
      throw new Error("没有玩家想法");
    const combined = playerIdeas
      .filter(Boolean)
      .map((i) => `- ${i}`)
      .join("\n");
    let prompt = P1.replace("{initial_idea}", combined);
    const playersInfo = this.room
      .get_online_players()
      .map((p) => `${p.name}(${this.gameInfo.roles[p.name] || "未选择角色"})`)
      .join("、");
    prompt = prompt.replace("{players}", playersInfo);
    const gameInfo = this.gameInfo;
    gameInfo.background = await new LLM().text(prompt, { temperature: 0.7 });
    return gameInfo.background;
  }

  async generateRolesFromBackground(background: string) {
    if (!background) throw new Error("背景故事不能为空");
    const prompt = ROLE_PROMPT.replace("{background}", background);
    const defs = (await new LLM().json(prompt, { temperature: 0.7 })) as Record<
      string,
      { name: string; description: string; actions?: string[] }
    >;
    return defs;
  }

  /**
   * 生成轮次事件 - AI驱动的动态内容生成
   * 
   * 功能说明：
   * - 基于背景故事和历史经验生成新事件
   * - 为每个角色生成个性化私密信息
   * - 提供多个决策选项供玩家选择
   * - 确保事件的逻辑连贯性和挑战性
   * 
   * AI生成流程：
   * 1. 构建Prompt：背景 + 当前轮次 + 历史经验
   * 2. 调用LLM生成JSON格式的事件数据
   * 3. 验证生成内容的完整性
   * 4. 重试机制：最多3次，失败返回默认结构
   * 
   * 生成内容结构：
   * - situation: 情况描述
   * - event: 事件标题、描述、决策选项
   * - private_messages: 四个角色的私密信息
   * 
   * 容错机制：
   * - 结构验证：确保包含所有必需字段
   * - 重试逻辑：AI失败时自动重试
   * - 降级处理：彻底失败时返回空结构
   * 
   * @param round_num 当前轮次号（1-5）
   * @returns Promise<生成的事件数据>
   */
  async generateEvent(round_num: number): Promise<GeneratedEvent> {
    const gameInfo = this.gameInfo;
    let prompt = P2.replace("{background}", gameInfo.background || "");
    prompt = prompt.replace("{current_round}", String(round_num));
    const prev = this._buildPreviousExperience(round_num) || "暂无之前经历";
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
    return {
      situation: "",
      event: {
        event_title: "",
        event_description: "",
        decision_options: {},
      },
      private_messages: {},
    };
  }

  async generateRoundAnalysis(current_round: number) {
    const gameInfo = this.gameInfo;
    if (current_round <= 1) {
      return "";
    }
    const prev = current_round - 1;
    const previous_experience = this._buildPreviousExperience(prev);
    let eventText = "";
    const prevRoundInfo = gameInfo.rounds[prev];
    if (prevRoundInfo) {
      eventText = prevRoundInfo.situation || "暂无事件";
    }

    const getChoice = (role: RoleEnum) => {
      const playerName = Object.keys(gameInfo.roles).find(
        (name) => gameInfo.roles[name] === role
      );
      if (playerName && prevRoundInfo?.player_actions[playerName]) {
        return prevRoundInfo.player_actions[playerName];
      }
      return "";
    };

    let prompt = P3;
    prompt = prompt.replace("{background}", gameInfo.background || "");
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

    // 更新当前轮次的情况描述
    if (!gameInfo.rounds[current_round]) {
      gameInfo.rounds[current_round] = {
        situation: analysis,
        decision_options: {},
        private_messages: {},
        player_actions: {},
        phase_remain: 180,
      };
    } else {
      gameInfo.rounds[current_round].situation = analysis;
    }

    return analysis;
  }

  async generateFinalReport() {
    const gameInfo = this.gameInfo;
    const outputs: string[] = [];
    for (let round = 1; round <= 5; round++) {
      const parts: string[] = [];
      const roundInfo = gameInfo.rounds[round];
      if (roundInfo) {
        if (roundInfo.situation) {
          parts.push(`第${round}轮情况：${roundInfo.situation}`);
        }
        if (Object.keys(roundInfo.player_actions).length > 0) {
          const summary = Object.entries(roundInfo.player_actions)
            .map(([playerName, action]) => {
              const role = gameInfo.roles[playerName] || "未知角色";
              return `${playerName}(${role})：${action}`;
            })
            .join("\n");
          parts.push(`玩家决策：\n${summary}`);
        }
      }
      outputs.push(parts.length ? parts.join("\n") : `第${round}轮：暂无数据`);
    }

    let prompt = P4.replace("{background}", gameInfo.background || "");
    prompt = prompt.replace("{output1}", outputs[0] || "暂无数据");
    prompt = prompt.replace("{output2}", outputs[1] || "暂无数据");
    prompt = prompt.replace("{output3}", outputs[2] || "暂无数据");
    prompt = prompt.replace("{output4}", outputs[3] || "暂无数据");
    prompt = prompt.replace("{output5}", outputs[4] || "暂无数据");

    // 替换玩家姓名
    const ceoName = Object.keys(gameInfo.roles).find(
      (name) => gameInfo.roles[name] === RoleEnum.CEO
    );
    if (ceoName) {
      prompt = prompt.replace(
        "CEO/Founder：[玩家姓名]",
        `CEO/Founder：${ceoName}`
      );
    }

    const roleMap: Record<RoleEnum, string> = {
      [RoleEnum.CTO]: "CTO",
      [RoleEnum.CMO]: "CMO",
      [RoleEnum.COO]: "COO",
      [RoleEnum.CEO]: "CEO",
    };

    for (const [playerName, role] of Object.entries(gameInfo.roles)) {
      if (role !== RoleEnum.CEO) {
        prompt = prompt.replace(
          `${roleMap[role]}：[玩家姓名]`,
          `${roleMap[role]}：${playerName}`
        );
      }
    }

    const overall = this._buildPreviousExperience(6) || "暂无之前经历";
    prompt = prompt.replace("{previous_experience}", overall);
    return new LLM().text(prompt, { temperature: 0.7 }) as unknown as string;
  }

  async calculateGameResult() {
    const gameInfo = this.gameInfo;
    const base_score = 50;
    const user_growth = Game._randInt(1000, 100000);
    const revenue = Game._randInt(10000, 1000000);
    const market_share = Game._randInt(1, 25);
    const team_size = Game._randInt(5, 100);

    // 计算总行动次数
    const total_actions = Object.values(gameInfo.rounds).reduce(
      (s, roundInfo) => s + Object.keys(roundInfo.player_actions).length,
      0
    );
    const score_bonus = Math.min(total_actions * 2, 50);
    const final_score = base_score + score_bonus;

    let success_level = "创业失败";
    if (final_score >= 90) success_level = "独角兽公司";
    else if (final_score >= 75) success_level = "成功上市";
    else if (final_score >= 60) success_level = "盈利稳定";
    else if (final_score >= 45) success_level = "勉强生存";

    const player_performance = this._calculatePlayerPerformance();
    const playerScores: Record<string, number> = {};
    for (const perf of player_performance) {
      playerScores[String((perf as any).player)] = Math.min(
        50 + Number((perf as any).contribution_score || 0),
        100
      );
    }

    let final_report = "";
    try {
      final_report = (await this.generateFinalReport()) as unknown as string;
    } catch {
      final_report = "报告生成失败，请稍后重试。";
    }

    // 更新 GameInfo 的结果
    gameInfo.result = { report: final_report };
    gameInfo.state = GameState.FINISHED;

    return {
      final_score,
      success_level,
      metrics: { user_growth, revenue, market_share, team_size },
      achievements: this._generateAchievements(final_score),
      timeline: this._generateTimeline(),
      player_performance,
      playerScores,
      final_report,
    };
  }

  private _calculatePlayerPerformance() {
    const gameInfo = this.gameInfo;
    const perf: Array<Record<string, any>> = [];
    for (const p of this.room.players) {
      // 计算玩家在所有轮次中的行动次数
      const action_count = Object.values(gameInfo.rounds).reduce(
        (s, roundInfo) => {
          return s + (roundInfo.player_actions[p.name] ? 1 : 0);
        },
        0
      );
      perf.push({
        player: p.name,
        role: gameInfo.roles[p.name],
        actions_taken: action_count,
        contribution_score: Math.min(action_count * 10, 50),
      });
    }
    return perf;
  }

  private _generateAchievements(score: number) {
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

  private _generateTimeline() {
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

  private _cancelRoundTimeout(round: number) {
    const key = this._taskKey(this.room.id, round);
    const t = Game._round_timeout_tasks.get(key);
    if (t) clearTimeout(t);
    Game._round_timeout_tasks.delete(key);
  }

  private _startRoundTick() {
    const existed = Game._round_tick_tasks.get(this.room.id);
    if (existed) clearInterval(existed);
    const timer = setInterval(async () => {
      try {
        if (!this.room || this.room.state !== RoomState.PLAYING)
          return clearInterval(timer);
        const gameInfo = this.gameInfo;
        const current_round = gameInfo.current_round;
        const roundInfo = gameInfo.rounds[current_round];

        // 更新剩余时间
        if (roundInfo && typeof roundInfo.phase_remain === "number") {
          roundInfo.phase_remain = Math.max(roundInfo.phase_remain - 1, 0);
        }

        const payload = {
          type: MessageType.ROUND_TICK,
          data: {
            round: current_round,
            phase: "discussion", // 简化阶段概念
            remaining: roundInfo?.phase_remain || 0,
            roundEvent: roundInfo,
            privateMessages: roundInfo?.private_messages || {},
            playerActions: Object.entries(roundInfo?.player_actions || {}),
            waitingForPlayers: !this._allPlayersSubmitted(current_round),
            players: this.room.players.map((p) => ({
              name: p.name,
              is_online: p.is_online,
              role: this.gameInfo.roles[p.name] || null,
              isHost: p.is_host,
            })),
          },
        };
        if (this.room) await this.room.broadcast(payload);
        if (
          roundInfo?.phase_remain === 0 &&
          !this._allPlayersSubmitted(current_round)
        ) {
          await this._autoSubmitMissingPlayers(current_round, "phase_end_auto");
        }
      } catch (e) {
        logger.error("[TICK] error:", (e as any)?.message || e);
        clearInterval(timer);
      }
    }, 1000);
    Game._round_tick_tasks.set(this.room.id, timer);
  }

  /**
   * 清理房间运行时资源 - 防止内存泄漏
   * 
   * 功能说明：
   * - 清理所有与房间相关的定时器
   * - 释放轮次计时和超时任务
   * - 防止房间删除后的内存泄漏
   * 
   * 清理范围：
   * 1. 轮次计时任务（每秒更新）
   * 2. 轮次超时任务（3分钟超时）
   * 3. 阶段切换任务（定时切换游戏阶段）
   * 
   * 调用时机：
   * - 房间被删除时
   * - 游戏异常结束时
   * - 系统维护清理时
   * 
   * 安全性：
   * - 确保所有计时器都被正确清理
   * - 避免孤儿定时器继续运行
   * - 释放Map中的引用，允许垃圾回收
   */
  cleanupRoom() {
    const tick = Game._round_tick_tasks.get(this.room.id);
    if (tick) clearInterval(tick);
    Game._round_tick_tasks.delete(this.room.id);

    for (const [key, timeout] of Array.from(
      Game._round_timeout_tasks.entries()
    )) {
      if (key.startsWith(`${this.room.id}:`)) {
        clearTimeout(timeout);
        Game._round_timeout_tasks.delete(key);
      }
    }
  }

  /**
   * 处理玩家创业想法提交
   * 
   * 功能说明：
   * - 记录玩家提交的创业想法
   * - 广播玩家状态更新
   * - 检查是否所有玩家都已提交
   * - 触发想法收集完成流程
   * 
   * 业务逻辑：
   * 1. 验证玩家存在性
   * 2. 存储想法到gameInfo.ideas
   * 3. 广播玩家加入消息（包含想法信息）
   * 4. 检查完成度，触发后续流程
   * 
   * 完成触发：
   * - 所有玩家都提交想法后
   * - 选择第一个玩家的想法作为主要想法
   * - 广播IDEAS_COMPLETE消息
   * 
   * @param player_name 玩家名称
   * @param idea 创业想法内容
   */
  async handle_startup_idea(player_name: string, idea: string) {
    const player = this.room.get_player(player_name);
    if (!player) return;
    // 将创业想法存储到 GameInfo 中
    this.gameInfo.ideas[player_name] = idea;
    await this.room.broadcast({
      type: MessageType.PLAYER_JOIN,
      data: {
        player_name: player_name,
        players: this.room.getPlayersPayload({
          includeRole: true,
          includeIdea: true,
        }),
      },
    });
    if (this.room.all_players_have_ideas()) {
      const firstPlayer = this.room.get_online_players()[0];
      this.gameInfo.selected_idea = firstPlayer ? this.gameInfo.ideas[firstPlayer.name] || "" : "";
      await this.room.broadcast({
        type: MessageType.IDEAS_COMPLETE,
        data: {
          startup_idea: this.gameInfo.selected_idea,
          players: this.room.getPlayersPayload({
            includeRole: true,
            includeIdea: true,
          }),
        },
      });
    }
  }

  async handle_start_game(player_name: string) {
    const player = this.room.get_player(player_name);
    if (!player || !player.is_host) return;
    if (this.room.state !== RoomState.PREPARE) return;
    await this.room.broadcast({
      type: MessageType.GAME_LOADING,
      data: { message: "AI正在生成游戏背景，请稍候..." },
    });
    const gameInfo = await this._ensureBackgroundAndRoles();
    this.room.state = RoomState.PLAYING;
    await this.room.broadcast({
      type: MessageType.GAME_START,
      data: {
        startup_idea: this.gameInfo.selected_idea,
        background: gameInfo.background,
        roles: gameInfo.roles,
      },
    });
  }

  /**
   * 处理玩家角色选择
   * 
   * 功能说明：
   * - 验证角色选择的合法性
   * - 防止重复选择和角色冲突
   * - 记录角色分配信息
   * - 检查是否可以开始游戏
   * 
   * 验证规则：
   * 1. 玩家存在性检查
   * 2. 防止重复选择（已选择过的玩家）
   * 3. 角色有效性验证（必须是有效的RoleEnum）
   * 4. 角色唯一性检查（不能被其他玩家占用）
   * 
   * 错误处理：
   * - 发送个人错误消息而非广播
   * - 保持其他玩家的正常游戏体验
   * 
   * 完成检查：
   * - 所有玩家都选择角色后自动开始游戏
   * - 生成背景故事和第一轮事件
   * 
   * @param player_name 玩家名称
   * @param role 选择的角色（CEO/CTO/CMO/COO）
   */
  async handle_role_selection(player_name: string, role: string) {
    const player = this.room.get_player(player_name);
    if (!player) return;
    if (this.gameInfo.roles[player_name]) {
      await this.room.send_to_player(player_name, {
        type: "role_selection_error",
        data: { message: "你已经选择过角色了" },
      });
      return;
    }
    if (!Object.values(RoleEnum).includes(role as RoleEnum)) {
      await this.room.send_to_player(player_name, {
        type: "role_selection_error",
        data: { message: `无效的角色: ${role}` },
      });
      return;
    }
    for (const p of this.room.players) {
      if (p.name !== player_name && this.gameInfo.roles[p.name] === (role as RoleEnum)) {
        await this.room.send_to_player(player_name, {
          type: "role_selection_error",
          data: { message: `角色 ${role} 已被其他玩家选择，请选择其他角色` },
        });
        return;
      }
    }
    // 将角色存储到 GameInfo 中
    this.gameInfo.roles[player_name] = role as RoleEnum;
    await this.room.broadcast({
      type: MessageType.ROLE_SELECTED,
      data: {
        selectedRoles: this.room.get_selected_roles(),
        players: this.room.getPlayersPayload(),
      },
    });
    if (this.room.all_players_have_roles()) {
      await this._auto_start_game_after_role_selection();
    }
  }

  private async _auto_start_game_after_role_selection() {
    this.room.state = RoomState.PLAYING;
    await this.room.broadcast({
      type: MessageType.GAME_LOADING,
      data: { message: "AI正在生成游戏背景和角色介绍，请稍候..." },
    });
    await this._ensureBackgroundAndRoles();
    await this.room.broadcast({
      type: MessageType.GAME_START,
      data: {
        startup_idea: this.gameInfo.selected_idea,
        background: this.gameInfo.background,
        roles: this.gameInfo.roles,
      },
    });
    this.gameInfo.current_round = 1;
    await this.room.broadcast({
      type: MessageType.ROUND_LOADING,
      data: { round: 1, message: "AI正在生成第1轮事件，请稍候..." },
    });
    const event = await this._prepareRoundData(1);
    this.room.state = RoomState.PLAYING;
    const roundInfo = this.gameInfo.rounds[1];
    await this.room.broadcast({
      type: MessageType.GAME_STARTED,
      data: {
        round: 1,
        roundEvent: roundInfo,
        privateMessages: roundInfo?.private_messages || {},
        isDefaultEvent: !!event.is_default_event,
      },
    });
    await this.room.broadcast({
      type: MessageType.ROUND_PHASE,
      data: { phase: "event_display", round: 1 },
    });
    this._schedulePhaseTransitions(1);
    // timeout auto submit
    const key = this._taskKey(this.room.id, 1);
    this._cancelRoundTimeout(1);
    Game._round_timeout_tasks.set(
      key,
      setTimeout(
        () => this._auto_submit_after_timeout(1),
        Game.ROUND_ACTION_TIMEOUT_SECONDS * 1000
      )
    );
  }

  /**
   * 处理游戏内玩家行动
   * 
   * 功能说明：
   * - 记录玩家在当前轮次的决策选择
   * - 实时广播行动提交状态
   * - 检查是否所有玩家都已提交
   * - 触发轮次完成或下一轮开始
   * 
   * 处理流程：
   * 1. 验证玩家和房间状态
   * 2. 记录行动到当前轮次数据
   * 3. 广播ACTION_SUBMITTED消息
   * 4. 检查提交完成度
   * 5. 触发轮次完成处理
   * 
   * 状态检查：
   * - 玩家必须存在且在线
   * - 房间状态必须是PLAYING
   * - 自动取消轮次超时任务
   * 
   * 完成处理：
   * - 所有玩家提交后立即处理轮次完成
   * - 进入下一轮或游戏结束流程
   * 
   * @param player_name 玩家名称
   * @param action_data 行动数据，包含action字段
   */
  async handle_game_action(player_name: string, action_data: any) {
    const player = this.room.get_player(player_name);
    if (!player || this.room.state !== RoomState.PLAYING) return;
    const gameInfo = this.gameInfo;
    const current_round = gameInfo.current_round;

    // 直接记录玩家行动到 RoundInfo
    this._addRoundAction(current_round, player_name, action_data?.action);

    await this.room.broadcast({
      type: MessageType.ACTION_SUBMITTED,
      data: {
        playerActions: Object.entries(
          gameInfo.rounds[current_round]?.player_actions || {}
        ),
        waitingForPlayers: !this._allPlayersSubmitted(current_round),
      },
    });

    if (this._allPlayersSubmitted(current_round)) {
      this._cancelRoundTimeout(current_round);
      await this._handle_round_complete();
    }
  }

  private async _handle_round_complete() {
    const gameInfo = this.gameInfo;
    if (gameInfo.current_round >= 5) await this._handle_game_complete();
    else await this._start_next_round();
  }

  private async _handle_game_complete() {
    try {
      const result = await this.calculateGameResult();
      this.room.state = RoomState.PREPARE;
      await this.room.broadcast({
        type: MessageType.GAME_COMPLETE,
        data: result,
      });
    } finally {
      this.cleanupRoom();
    }
  }

  private async _start_next_round() {
    const gameInfo = this.gameInfo;
    const next = gameInfo.current_round + 1;
    await this.room.broadcast({
      type: MessageType.ROUND_LOADING,
      data: { round: next, message: `AI正在生成第${next}轮事件，请稍候...` },
    });
    try {
      await this.generateRoundAnalysis(next);
    } catch {}
    const event = await this._prepareRoundData(next);
    gameInfo.current_round = next;
    const roundInfo = gameInfo.rounds[next];
    await this.room.broadcast({
      type: MessageType.ROUND_START,
      data: {
        round: next,
        roundEvent: roundInfo,
        privateMessages: roundInfo?.private_messages || {},
        isDefaultEvent: !!event.is_default_event,
      },
    });
    await this.room.broadcast({
      type: MessageType.ROUND_PHASE,
      data: { phase: "event_display", round: next },
    });
    this._schedulePhaseTransitions(next);
    const key = this._taskKey(this.room.id, next);
    this._cancelRoundTimeout(next);
    Game._round_timeout_tasks.set(
      key,
      setTimeout(
        () => this._auto_submit_after_timeout(next),
        Game.ROUND_ACTION_TIMEOUT_SECONDS * 1000
      )
    );
  }

  async handle_restart_game(player_name: string) {
    const player = this.room.get_player(player_name);
    if (!player || !player.is_host) return;
    this.cleanupRoom();
    this.gameInfo = createDefaultGameInfo();
    this.gameInfo.selected_idea = "";
    this.room.state = RoomState.PREPARE;
    await this.room.broadcast({
      type: MessageType.GAME_RESTART,
      data: {
        players: this.room.getPlayersPayload({
          includeRole: true,
          includeIdea: true,
        }),
      },
    });
  }

  private async _auto_submit_after_timeout(round_num: number) {
    try {
      if (this.room.state !== RoomState.PLAYING) return;
      await this._autoSubmitMissingPlayers(round_num, "round_timeout_auto");
    } finally {
      await this._handle_round_complete();
    }
  }
}
