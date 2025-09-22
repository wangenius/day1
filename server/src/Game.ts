import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Room } from "./Room.js";
import {
  GameState,
  GameStatus,
  RoleEnum,
  RoomStatus,
  RoundState,
} from "./types/types.js";
import { LLM } from "./utils/llm.js";
import { logger } from "./utils/logger.js";

const promptDir = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "prompt"
);
const readPrompt = (name: string) =>
  fs.readFileSync(path.join(promptDir, name), "utf-8");

const P1 = readPrompt("prompt1.txt");
const P2 = readPrompt("prompt2.txt");
const P3 = readPrompt("prompt3.txt");
const P4 = readPrompt("prompt4.txt");

const GeneratedEventSchema = z.object({
  situation: z.string().describe("在上一轮决策下的企业发展状态描述"),
  event: z.string().describe("当前轮次事件的标题"),
  options: z
    .record(z.string())
    .describe(
      "三个决策选项，键为选项标识（A、B、C），值为决策选项内容（每条不超过40个字）"
    ),
  messages: z
    .record(z.string())
    .describe(
      "四个角色的私密信息，键为角色代码（CEO、CTO、CMO、COO），值为该角色的专属信息（最多30个字）。"
    ),
});

/**
 * AI生成事件的数据结构
 * 用于定义LLM生成的游戏事件格式：
 * - situation: 当前轮次的情况描述
 * - event: 具体的事件内容和决策选项
 * - private_messages: 每个角色的私密信息
 * - is_default_event: 是否为默认事件（AI生成失败时的兜底）
 */
interface GeneratedEvent {
  situation?: string;
  event: {
    event_description: string;
    decision_options: Record<string, string>;
  };
  private_messages: Record<string, string>;
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
function createDefaultGameInfo(): GameState {
  return {
    state: GameStatus.PLAYING,
    result: { report: "" },
    ideas: {},
    selected_idea: "",
    roles: {},
    background: "",
    rounds: {},
    current_round: 1,
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
  state: GameState;

  /** 关联的房间实例 - 用于消息广播和玩家管理 */
  room: Room;

  /** 轮次行动超时时间（秒） - 玩家必须在此时间内提交行动 */
  static ROUND_ACTION_TIMEOUT_SECONDS = 180;

  /** 轮次行动超时任务管理器 - 使用房间ID:轮次号作为键 */
  private static _round_timeout_tasks: Map<string, NodeJS.Timeout> = new Map();

  /** 轮次计时任务管理器 - 每秒更新剩余时间并广播 */
  private static _round_tick_tasks: Map<string, NodeJS.Timeout> = new Map();

  /** 轮次完成状态锁 - 防止多重触发轮次完成逻辑 */
  private _round_completing = false;

  /** 当前正在处理的轮次 - 用于状态验证 */
  private _processing_round = 0;

  /**
   * 构造函数 - 初始化游戏实例
   *
   * @param room 关联的房间实例
   */
  constructor(room: Room) {
    this.room = room;
    this.state = createDefaultGameInfo();
  }
  private _taskKey(roomId: string, round: number) {
    return `${roomId}:${round}`;
  }
  private _buildPreviousExperience(upToRound: number) {
    const gameInfo = this.state;
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
    // 验证轮次状态一致性
    if (this.state.current_round !== round_num) {
      logger.warn(
        `[SUBMIT_CHECK] Round mismatch: checking ${round_num}, current ${this.state.current_round}`
      );
      return false;
    }

    const roundInfo = this.state.rounds[round_num];
    if (!roundInfo) {
      logger.warn(`[SUBMIT_CHECK] Round ${round_num} info not found`);
      return false;
    }

    // 使用游戏中的所有玩家（包括离线玩家）来判断是否所有人都已提交
    // 这样可以避免因玩家临时断线导致的轮次提前结束
    const allPlayers = this.room.get_all_players();
    const onlinePlayers = this.room.get_online_players();
    const submitted = Object.keys(roundInfo.player_actions);
    const all_submitted = submitted.length === allPlayers.length;

    logger.info(
      `[SUBMIT_CHECK] Round ${round_num}: ${submitted.length}/${allPlayers.length} players submitted (${onlinePlayers.length} online), all_submitted: ${all_submitted}`
    );

    if (!all_submitted) {
      const missing = allPlayers
        .filter((p) => !submitted.includes(p.name))
        .map((p) => p.name);
      const missingOnline = missing.filter((name) =>
        onlinePlayers.some((p) => p.name === name)
      );
      const missingOffline = missing.filter(
        (name) => !onlinePlayers.some((p) => p.name === name)
      );
      logger.info(
        `[SUBMIT_CHECK] Missing players - Online: [${missingOnline.join(
          ", "
        )}], Offline: [${missingOffline.join(", ")}]`
      );
    }

    return all_submitted;
  }

  private _addRoundAction(
    round_num: number,
    player_name: string,
    action: string
  ) {
    const gameInfo = this.state;
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

  // 统一：确保背景与角色已生成
  private async background() {
    const gameInfo = this.state;
    if (!gameInfo.background) {
      const ideas = Object.values(gameInfo.ideas);
      try {
        gameInfo.background = await this.generateBackgroundFromIdeas(ideas);
      } catch {
        gameInfo.background = "创业团队正在开始他们的创业之旅...";
      }
    }

    this.room.broadcast({
      type: "game_state",
      data: {
        room_state: this.room.state,
        game_state: this.state,
        players: this.room.get_all_players(),
      },
    });

    return gameInfo;
  }

  // 统一：生成并写入当轮事件数据
  private async prepareRoundEvent(round_num: number) {
    const state = this.state;
    const event = await this.generateEvent(round_num);

    // 创建 RoundInfo
    const roundInfo: RoundState = {
      situation: event.situation || "",
      decision_options: event.event.decision_options,
      private_messages: event.private_messages,
      player_actions: {},
      phase_remain: 180,
    };

    state.rounds[round_num] = roundInfo;
    return event;
  }

  // 统一：到点为未提交玩家自动提交
  private async _autoSubmitMissingPlayers(round_num: number, reason: string) {
    logger.info(
      `[AUTO_SUBMIT] Starting auto-submit for round ${round_num}, reason: ${reason}`
    );

    // 验证轮次状态
    if (this.state.current_round !== round_num) {
      logger.warn(
        `[AUTO_SUBMIT] Round mismatch: expected ${round_num}, current ${this.state.current_round}`
      );
      return;
    }

    const roundInfo = this.state.rounds[round_num];
    if (!roundInfo) {
      logger.warn(`[AUTO_SUBMIT] Round ${round_num} info not found`);
      return;
    }

    const option_keys = Object.keys(roundInfo.decision_options);
    if (option_keys.length === 0) {
      option_keys.push("A", "B", "C");
    }

    // 只为在线但未提交的玩家自动提交行动
    // 离线玩家应该等待重新上线后自己提交，除非是超时情况
    const allPlayers = this.room.get_all_players();
    const onlinePlayers = this.room.get_online_players();
    const submitted = new Set(Object.keys(roundInfo.player_actions));
    const missing_online = onlinePlayers.filter((p) => !submitted.has(p.name));
    const missing_offline = allPlayers.filter(
      (p) => !p.is_online && !submitted.has(p.name)
    );

    logger.info(
      `[AUTO_SUBMIT] Found ${missing_online.length} online players and ${missing_offline.length} offline players needing submission`
    );

    // 根据原因决定是否为离线玩家自动提交
    let players_to_submit = missing_online;
    if (reason === "timeout") {
      // 超时情况下，为所有未提交的玩家（包括离线）自动提交
      players_to_submit = [...missing_online, ...missing_offline];
      logger.info(
        `[AUTO_SUBMIT] Timeout reached, auto-submitting for all missing players including offline ones`
      );
    } else {
      // 非超时情况下，只为在线玩家自动提交，等待离线玩家回归
      logger.info(
        `[AUTO_SUBMIT] Waiting for ${missing_offline.length} offline players to return and submit`
      );
    }

    // 批量处理自动提交，避免递归调用链
    for (const p of players_to_submit) {
      const choice =
        option_keys[Math.floor(Math.random() * option_keys.length)] || "A";
      const status = p.is_online ? "online" : "offline";
      logger.info(
        `[AUTO_SUBMIT] Auto-submitting ${choice} for ${status} player ${p.name}`
      );

      // 直接添加行动记录，避免通过handle_game_action触发额外逻辑
      this._addRoundAction(round_num, p.name, choice);
    }

    // 如果有自动提交的玩家，广播状态更新
    if (players_to_submit.length > 0) {
      await this.room.broadcast({
        type: "game_state",
        data: {
          room_state: this.room.state,
          game_state: this.state,
          players: this.room.get_all_players(),
        },
      });

      // 检查是否所有玩家都已提交，如果是则触发轮次完成
      if (this._allPlayersSubmitted(round_num)) {
        logger.info(
          `[AUTO_SUBMIT] All players submitted after auto-submit, completing round ${round_num}`
        );
        await this._handle_round_complete();
      }
    }
  }

  // 统一：安排阶段切换与tick
  private _schedulePhaseTransitions(expected_round: number) {
    setTimeout(async () => {
      const r = this.room;
      if (!r) return;
      const gameInfo = this.state;
      if (
        gameInfo.current_round !== expected_round ||
        r.state !== RoomStatus.PLAYING
      )
        return;
      await r.broadcast({
        type: "game_state",
        data: {
          room_state: this.room.state,
          game_state: this.state,
          players: this.room.get_all_players(),
        },
      });
    }, 10000);
    setTimeout(async () => {
      const r = this.room;
      if (!r) return;
      const gameInfo = this.state;
      if (
        gameInfo.current_round !== expected_round ||
        r.state !== RoomStatus.PLAYING
      )
        return;
      await r.broadcast({
        type: "game_state",
        data: {
          room_state: this.room.state,
          game_state: this.state,
          players: this.room.get_all_players(),
        },
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
      .map((p) => `${p.name}(${this.state.roles[p.name] || "未选择角色"})`)
      .join("、");
    prompt = prompt.replace("{players}", playersInfo);
    const gameInfo = this.state;
    gameInfo.background = await new LLM().text(prompt, { temperature: 0.7 });
    return gameInfo.background;
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
    const gameInfo = this.state;
    let prompt = P2.replace("{background}", gameInfo.background || "");
    prompt = prompt.replace("{current_round}", String(round_num));
    const prev = this._buildPreviousExperience(round_num) || "暂无之前经历";
    prompt = prompt.replace("{previous_experience}", prev);

    const llm = new LLM();
    const json = await llm.json(prompt, {
      temperature: 0.7,
      schema: GeneratedEventSchema,
    });
    logger.info(json);
    return {
      situation: json.event,
      event: {
        event_description: json.event,
        decision_options: json.options,
      },
      private_messages: json.messages,
    };
  }

  async generateRoundAnalysis(current_round: number) {
    const gameInfo = this.state;
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
    const gameInfo = this.state;
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
    const gameInfo = this.state;
    let final_report = "";
    try {
      final_report = (await this.generateFinalReport()) as unknown as string;
    } catch {
      final_report = "报告生成失败，请稍后重试。";
    }

    // 更新 GameInfo 的结果
    gameInfo.result = { report: final_report };
    gameInfo.state = GameStatus.FINISHED;

    return {
      final_report,
    };
  }

  private _cancelRoundTimeout(round: number) {
    const key = this._taskKey(this.room.id, round);
    const t = Game._round_timeout_tasks.get(key);
    if (t) {
      clearTimeout(t);
      logger.info(`[TIMER_CLEANUP] Cancelled timeout for round ${round}`);
    } else {
      logger.warn(`[TIMER_CLEANUP] No timeout found for round ${round}`);
    }
    Game._round_timeout_tasks.delete(key);
  }

  private _startRoundTick() {
    const current_round = this.state.current_round;
    const tickKey = this._taskKey(this.room.id, current_round);

    // 清理旧的tick任务
    const existed = Game._round_tick_tasks.get(tickKey);
    if (existed) {
      clearInterval(existed);
      Game._round_tick_tasks.delete(tickKey);
    }

    const timer = setInterval(async () => {
      try {
        if (!this.room || this.room.state !== RoomStatus.PLAYING) {
          clearInterval(timer);
          Game._round_tick_tasks.delete(tickKey);
          return;
        }

        const gameInfo = this.state;
        const tick_round = gameInfo.current_round;

        // 如果轮次已经改变，停止当前tick
        if (tick_round !== current_round) {
          logger.info(
            `[TICK] Round changed from ${current_round} to ${tick_round}, stopping tick`
          );
          clearInterval(timer);
          Game._round_tick_tasks.delete(tickKey);
          return;
        }

        const roundInfo = gameInfo.rounds[tick_round];

        // 更新剩余时间
        if (roundInfo && typeof roundInfo.phase_remain === "number") {
          roundInfo.phase_remain = Math.max(roundInfo.phase_remain - 1, 0);
        }

        if (this.room) {
          await this.room.broadcast({
            type: "game_state",
            data: {
              game_state: gameInfo,
              room_state: this.room.state,
              players: this.room.get_all_players(),
            },
          });
        }

        // 检查是否需要自动提交
        if (
          roundInfo?.phase_remain === 0 &&
          !this._allPlayersSubmitted(tick_round)
        ) {
          await this._autoSubmitMissingPlayers(tick_round, "phase_end_auto");
        }
      } catch (e) {
        logger.error("[TICK] error:", (e as any)?.message || e);
        clearInterval(timer);
        Game._round_tick_tasks.delete(tickKey);
      }
    }, 1000);

    Game._round_tick_tasks.set(tickKey, timer);
    logger.info(
      `[TICK] Started tick for round ${current_round}, key: ${tickKey}`
    );
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
    logger.info(`[CLEANUP] Starting cleanup for room ${this.room.id}`);

    const tick = Game._round_tick_tasks.get(this.room.id);
    if (tick) {
      clearInterval(tick);
      logger.info(`[CLEANUP] Cleared round tick for room ${this.room.id}`);
    }
    Game._round_tick_tasks.delete(this.room.id);

    let timeoutCount = 0;
    for (const [key, timeout] of Array.from(
      Game._round_timeout_tasks.entries()
    )) {
      if (key.startsWith(`${this.room.id}:`)) {
        clearTimeout(timeout);
        Game._round_timeout_tasks.delete(key);
        timeoutCount++;
      }
    }

    logger.info(
      `[CLEANUP] Cleared ${timeoutCount} round timeouts for room ${this.room.id}`
    );
    logger.info(`[CLEANUP] Cleanup completed for room ${this.room.id}`);
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
    this.state.ideas[player_name] = idea;
    await this.room.broadcast({
      type: "game_state",
      data: {
        game_state: this.state,
      },
    });
    if (this.room.all_players_have_ideas()) {
      const firstPlayer = this.room.get_online_players()[0];
      this.state.selected_idea = firstPlayer
        ? this.state.ideas[firstPlayer.name] || ""
        : "";
      await this.room.broadcast({
        type: "game_state",
        data: {
          game_state: this.state,
        },
      });
    }
  }

  async handle_start_game(player_name: string) {
    const player = this.room.get_player(player_name);
    if (!player || !player.is_host) {
      logger.warn(
        `[START_GAME] Player ${player_name} is not host or not found`
      );
      return;
    }

    if (this.room.state !== RoomStatus.WAITING) {
      logger.warn(`[START_GAME] Room state is not WAITING: ${this.room.state}`);
      return;
    }

    logger.info(`[START_GAME] Starting game in room ${this.room.id}`);

    // 更新房间状态为游戏中
    this.room.state = RoomStatus.PLAYING;

    // 广播游戏开始状态
    await this.room.broadcast({
      type: "game_state",
      data: {
        room_state: this.room.state,
        game_state: this.state,
        players: this.room.get_all_players(),
      },
    });

    logger.info(
      `[START_GAME] Game started successfully in room ${this.room.id}`
    );
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
   * @param player_id 玩家名称
   * @param role 选择的角色（CEO/CTO/CMO/COO）
   */
  async handle_role_selection(player_id: string, role: string) {
    const player = this.room.get_player(player_id);
    if (!player) return;
    if (this.state.roles[player_id]) {
      await this.room.send_to_player(player_id, {
        type: "role_selection_error",
        data: { message: "你已经选择过角色了" },
      });
      return;
    }
    if (!Object.values(RoleEnum).includes(role as RoleEnum)) {
      await this.room.send_to_player(player_id, {
        type: "role_selection_error",
        data: { message: `无效的角色: ${role}` },
      });
      return;
    }
    for (const p of this.room.players.values()) {
      if (
        p.name !== player_id &&
        this.state.roles[p.name] === (role as RoleEnum)
      ) {
        await this.room.send_to_player(player_id, {
          type: "role_selection_error",
          data: { message: `角色 ${role} 已被其他玩家选择，请选择其他角色` },
        });
        return;
      }
    }
    this.state.roles[player_id] = role as RoleEnum;
    await this.room.broadcast({
      type: "game_state",
      data: {
        room_state: this.room.state,
        game_state: this.state,
        players: this.room.get_all_players(),
      },
    });
    if (this.room.all_players_have_roles()) {
      await this._auto_start_game_after_role_selection();
    }
  }

  private async _auto_start_game_after_role_selection() {
    await Promise.allSettled([
      this.background(),
      new Promise((resolve) => {
        setTimeout(resolve, 6000);
      }),
    ]);

    // 准备第一轮数据
    await this.prepareRoundEvent(1);
    this.state.current_round = 1;

    await this.room.broadcast({
      type: "game_state",
      data: {
        room_state: this.room.state,
        game_state: this.state,
        players: this.room.get_all_players(),
      },
    });
    this._schedulePhaseTransitions(1);
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
    logger.info(
      `[GAME_ACTION] Player ${player_name} submitted action:`,
      action_data
    );

    const player = this.room.get_player(player_name);
    if (!player) {
      logger.warn(`[GAME_ACTION] Player ${player_name} not found`);
      return;
    }

    if (this.room.state !== RoomStatus.PLAYING) {
      logger.warn(
        `[GAME_ACTION] Room not in PLAYING state: ${this.room.state}`
      );
      return;
    }

    // 防止在轮次完成过程中接收新的行动
    if (this._round_completing) {
      logger.warn(
        `[GAME_ACTION] Round is completing, ignoring action from ${player_name}`
      );
      return;
    }

    const gameInfo = this.state;
    const current_round = gameInfo.current_round;
    const submitted_round = action_data?.round;

    // 验证提交的轮次是否与当前轮次匹配
    if (submitted_round && submitted_round !== current_round) {
      logger.warn(
        `[GAME_ACTION] Player ${player_name} submitted action for round ${submitted_round}, but current round is ${current_round}. Ignoring outdated action.`
      );
      return;
    }

    // 检查玩家是否已经提交过行动
    const roundInfo = gameInfo.rounds[current_round];
    if (roundInfo && roundInfo.player_actions[player_name]) {
      logger.warn(
        `[GAME_ACTION] Player ${player_name} already submitted action for round ${current_round}, ignoring duplicate`
      );
      return;
    }

    logger.info(`[GAME_ACTION] Processing action for round ${current_round}`);

    // 直接记录玩家行动到 RoundInfo
    this._addRoundAction(current_round, player_name, action_data?.action);

    await this.room.broadcast({
      type: "game_state",
      data: {
        room_state: this.room.state,
        game_state: this.state,
        players: this.room.get_all_players(),
      },
    });

    if (this._allPlayersSubmitted(current_round)) {
      logger.info(
        `[GAME_ACTION] All players submitted for round ${current_round}, completing round`
      );
      await this._handle_round_complete();
    } else {
      logger.info(
        `[GAME_ACTION] Waiting for more players to submit for round ${current_round}`
      );
    }
  }

  private async _handle_round_complete() {
    // 防止多重触发的状态锁
    if (this._round_completing) {
      logger.info(
        `[ROUND_COMPLETE] Round ${this.state.current_round} already completing, skipping duplicate call`
      );
      return;
    }

    this._round_completing = true;
    const current_round = this.state.current_round;
    logger.info(`[ROUND_COMPLETE] Starting round ${current_round} completion`);

    try {
      const gameInfo = this.state;

      // 验证轮次状态一致性
      if (
        this._processing_round !== 0 &&
        this._processing_round !== current_round
      ) {
        logger.warn(
          `[ROUND_COMPLETE] Round mismatch: processing ${this._processing_round}, current ${current_round}`
        );
        return;
      }

      this._processing_round = current_round;

      // 清理当前轮次的定时器
      this._cancelRoundTimeout(current_round);
      const tickKey = this._taskKey(this.room.id, current_round);
      const tickTask = Game._round_tick_tasks.get(tickKey);
      if (tickTask) {
        clearInterval(tickTask);
        Game._round_tick_tasks.delete(tickKey);
        logger.info(
          `[ROUND_COMPLETE] Cancelled tick task for round ${current_round}`
        );
      }

      // 立即广播状态，让前端知道轮次已完成，应该显示加载页面
      await this.room.broadcast({
        type: "game_state",
        data: {
          room_state: this.room.state,
          game_state: this.state,
          players: this.room.get_all_players(),
        },
      });

      if (gameInfo.current_round >= 5) {
        await this._handle_game_complete();
      } else {
        await this._start_next_round();
      }

      logger.info(
        `[ROUND_COMPLETE] Round ${current_round} completed successfully`
      );
    } catch (error) {
      logger.error(
        `[ROUND_COMPLETE] Error completing round ${current_round}:`,
        error
      );
      throw error;
    } finally {
      this._round_completing = false;
      this._processing_round = 0;
    }
  }

  private async _handle_game_complete() {
    try {
      this.state.state = GameStatus.FINISHED;
      // 立即广播状态，让前端知道轮次已完成，应该显示加载页面
      await this.room.broadcast({
        type: "game_state",
        data: {
          room_state: this.room.state,
          game_state: this.state,
          players: this.room.get_all_players(),
        },
      });

      // 计算游戏结果并生成最终报告
      await this.calculateGameResult();

      await this.room.broadcast({
        type: "game_state",
        data: {
          room_state: this.room.state,
          game_state: this.state,
          players: this.room.get_all_players(),
        },
      });
    } finally {
      this.cleanupRoom();
    }
  }

  private async _start_next_round() {
    const state = this.state;
    const previous_round = state.current_round;

    logger.info(
      `[START_NEXT_ROUND] Starting transition from round ${previous_round} to ${
        previous_round + 1
      }`
    );

    // 先设置current_round
    state.current_round = state.current_round + 1;
    const new_round = state.current_round;

    logger.info(`[START_NEXT_ROUND] Updated current_round to ${new_round}`);

    // 立即广播轮次切换状态，让所有玩家知道正在准备新轮次
    await this.room.broadcast({
      type: "game_state",
      data: {
        room_state: this.room.state,
        game_state: this.state,
        players: this.room.get_all_players(),
      },
    });

    logger.info(
      `[START_NEXT_ROUND] Broadcasted initial state for round ${new_round}`
    );

    await this.generateRoundAnalysis(new_round);
    logger.info(
      `[START_NEXT_ROUND] Generated round analysis for round ${new_round}`
    );

    // 再准备轮次事件
    await this.prepareRoundEvent(new_round);
    logger.info(
      `[START_NEXT_ROUND] Prepared round event for round ${new_round}`
    );

    // 再次广播完整的轮次数据
    await this.room.broadcast({
      type: "game_state",
      data: {
        room_state: this.room.state,
        game_state: this.state,
        players: this.room.get_all_players(),
      },
    });

    logger.info(
      `[START_NEXT_ROUND] Broadcasted complete game state for round ${new_round}`
    );

    this._schedulePhaseTransitions(new_round);
    const key = this._taskKey(this.room.id, new_round);
    this._cancelRoundTimeout(new_round);

    Game._round_timeout_tasks.set(
      key,
      setTimeout(
        () => this._auto_submit_after_timeout(new_round),
        Game.ROUND_ACTION_TIMEOUT_SECONDS * 1000
      )
    );

    logger.info(
      `[START_NEXT_ROUND] Set timeout for round ${new_round}, duration: ${Game.ROUND_ACTION_TIMEOUT_SECONDS}s`
    );
  }

  async handle_restart_game(player_name: string) {
    const player = this.room.get_player(player_name);
    if (!player || !player.is_host) return;
    this.cleanupRoom();
    this.state = createDefaultGameInfo();
    this.state.selected_idea = "";
    this.room.state = RoomStatus.WAITING;
    await this.room.broadcast({
      type: "game_state",
      data: {
        room_state: this.room.state,
        game_state: this.state,
        players: this.room.get_all_players(),
      },
    });
  }

  private async _auto_submit_after_timeout(round_num: number) {
    if (this.room.state !== RoomStatus.PLAYING) {
      logger.info(
        `[TIMEOUT] Room not in PLAYING state, skipping timeout for round ${round_num}`
      );
      return;
    }

    // 防止在轮次完成过程中触发超时
    if (this._round_completing) {
      logger.info(
        `[TIMEOUT] Round ${round_num} is completing, skipping timeout`
      );
      return;
    }

    logger.info(`[TIMEOUT] Auto-submitting for round ${round_num}`);

    // 验证轮次状态
    if (this.state.current_round !== round_num) {
      logger.warn(
        `[TIMEOUT] Round mismatch: expected ${round_num}, current ${this.state.current_round}`
      );
      return;
    }

    // 检查是否所有玩家都已提交
    if (this._allPlayersSubmitted(round_num)) {
      logger.info(
        `[TIMEOUT] All players already submitted for round ${round_num}, no timeout needed`
      );
      return;
    }

    // 执行自动提交，使用timeout原因
    await this._autoSubmitMissingPlayers(round_num, "timeout");
  }
}
