import {
  GameState,
  RoleEnum,
  Player,
  DecisionEvent,
  GeneratedEvent,
  GameResult,
} from "./types/types.js";
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

/**
 * 游戏房间
 * 1. 房间ID
 * 2. 玩家列表
 * 3. 创业想法
 * 4. 创建时间
 */
export class GameRoom {
  // 房间ID
  room_id: string;
  // 玩家列表
  players: Player[] = [];
  // 创业想法
  startup_idea: string | null = null;
  // 创建时间
  created_at: Date;
  // 游戏状态
  game_state: GameState = GameState.LOBBY;
  // 背景故事
  background: string | null = null;
  dynamic_roles: Record<
    string,
    { name: string; description: string; actions?: string[] }
  > | null = null;
  game_result: GameResult | null = null;
  round_events: Record<number, DecisionEvent> = {};
  round_private_messages: Record<number, Record<string, string>> = {};
  dynamic_round_info: Record<number, string> = {};
  round_situation: Record<number, string | Record<string, unknown>> = {};
  current_round = 1;
  round_actions: Record<number, Array<Record<string, any>>> = {};
  current_phase: string | null = null;
  phase_remain = 180;

  constructor(room_id: string, created_at: Date) {
    this.room_id = room_id;
    this.created_at = created_at;
  }

  /**
   * 给指定玩家发送消息（若该玩家在线且有 socket）
   */
  async send_to_player(player_name: string, message: any) {
    const p = this.get_player(player_name) as any;
    const ws = p?.socket as any;
    if (!ws || ws.readyState !== ws?.OPEN) return;
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // ignore
    }
  }

  /**
   * 向房间内在线玩家广播消息
   */
  async broadcast(message: any, exclude_player?: string) {
    let sent = 0;
    for (const p of this.players as any[]) {
      if (!p.is_online) continue;
      if (exclude_player && p.name === exclude_player) continue;
      const ws = p?.socket as any;
      if (!ws || ws.readyState !== ws?.OPEN) continue;
      await this.send_to_player(p.name, message);
      sent++;
    }
    return sent;
  }

  set_phase(phase: string, remain: number) {
    this.current_phase = phase;
    this.phase_remain = remain;
  }

  add_player(player: Player) {
    if (this.game_state !== GameState.LOBBY)
      throw new Error("游戏已开始，无法加入房间");
    const existing = this.get_player(player.name);
    if (existing) {
      existing.is_online = true;
      return true;
    }
    if (this.get_online_players().length >= 4)
      throw new Error("房间已满，最多4人");
    if (this.players.length === 0) player.is_host = true;
    this.players.push(player);
    return true;
  }

  remove_player(player_name: string) {
    const p = this.get_player(player_name);
    if (p) p.is_online = false;
    return true;
  }

  get_player(player_name: string) {
    return this.players.find((p) => p.name === player_name) || null;
  }

  get_online_players() {
    return this.players.filter((p) => p.is_online);
  }

  all_players_have_ideas() {
    const online = this.get_online_players();
    return online.every((p) => !!p.startup_idea);
  }

  all_players_have_roles() {
    const online = this.get_online_players();
    return online.every((p) => !!p.role);
  }

  get_selected_roles(): string[] {
    return this.players
      .filter((p) => p.role)
      .map((p) => p.role as unknown as string);
  }

  all_players_submitted_actions(round_num: number) {
    const online = this.get_online_players();
    const submitted = new Set<string>();
    const arr = this.round_actions[round_num] || [];
    arr.forEach((a) => submitted.add(a?.playerName));
    return submitted.size === online.length;
  }

  add_round_action(round_num: number, action: Record<string, any>) {
    if (!this.round_actions[round_num]) this.round_actions[round_num] = [];
    this.round_actions[round_num] = this.round_actions[round_num].filter(
      (a) => a?.playerName !== action?.playerName
    );
    this.round_actions[round_num].push(action);
  }

  get_round_info(round_num: number) {
    if (this.dynamic_round_info[round_num])
      return this.dynamic_round_info[round_num];
    return "";
  }

  set_round_info(round_num: number, info: string) {
    this.dynamic_round_info[round_num] = info;
  }

  async generate_background_from_ideas(player_ideas: string[]) {
    if (!player_ideas || player_ideas.length === 0)
      throw new Error("没有玩家想法");
    const combined = player_ideas
      .filter(Boolean)
      .map((i) => `- ${i}`)
      .join("\n");
    let prompt = P1.replace("{initial_idea}", combined);
    const playersInfo = this.players
      .filter((p) => p.is_online)
      .map((p) => `${p.name}(${p.role || "未选择角色"})`)
      .join("、");
    prompt = prompt.replace("{players}", playersInfo);
    this.background = await new LLM().text(prompt, { temperature: 0.7 });
    return this.background;
  }

  async generate_roles_from_background(background: string) {
    if (!background) throw new Error("背景故事不能为空");
    const prompt = ROLE_PROMPT.replace("{background}", background);
    const defs = (await new LLM().json(prompt, { temperature: 0.7 })) as Record<
      string,
      { name: string; description: string; actions?: string[] }
    >;
    return defs;
  }

  async generate_event(round_num: number): Promise<GeneratedEvent> {
    let prompt = P2.replace("{background}", this.background || "");
    prompt = prompt.replace("{current_round}", String(round_num));
    const prev = this._build_previous_experience(round_num) || "暂无之前经历";
    prompt = prompt.replace("{previous_experience}", prev);

    const llm = new LLM();
    for (let i = 0; i < 3; i++) {
      try {
        const json = (await llm.json(prompt, {
          temperature: 0.7,
        })) as unknown as GeneratedEvent;
        if (!this._validate_event_response(json))
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
    return this._get_default_event(round_num);
  }

  private _build_history_summary(up_to_round: number) {
    if (up_to_round <= 1) return "";
    const parts: string[] = [];
    for (let r = 1; r < up_to_round; r++) {
      const roundParts: string[] = [];
      const sit = this.round_situation[r];
      if (sit) {
        const text =
          typeof sit === "object"
            ? String((sit as any).impact || sit)
            : String(sit);
        roundParts.push(`第${r}轮情况：${text}`);
      }
      const eventObj = this.round_events[r];
      if (eventObj) {
        const title =
          (eventObj as any).event_title || (eventObj as any).title || "";
        const desc =
          (eventObj as any).event_description ||
          (eventObj as any).description ||
          "";
        roundParts.push(`事件：${`${title} - ${desc}`.replace(/ -$/, "")}`);
      }
      const actions = this.round_actions[r] || [];
      if (actions.length) {
        const lines = actions.map(
          (a) =>
            `${a.playerName || a.player}(${String(a.role || "")})：${
              a.action || ""
            }`
        );
        roundParts.push("玩家决策：\n" + lines.join("\n"));
      }
      if (roundParts.length) parts.push(roundParts.join("\n"));
    }
    return parts.join("\n\n");
  }

  private _build_previous_experience(up_to_round: number) {
    if (up_to_round <= 1) return "";
    const parts: string[] = [];
    for (let r = 1; r < up_to_round; r++) {
      let eventText = "暂无事件";
      const eventObj = this.round_events[r];
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
          ? String(val.impact || val)
          : String(val);
      let resultText = "暂无结果";
      if (this.round_situation[r + 1])
        resultText = normalize(this.round_situation[r + 1]);
      else if (this.round_situation[r])
        resultText = normalize(this.round_situation[r]);
      parts.push(`第${r}轮事件：${eventText}\n第${r}轮结果：${resultText}`);
    }
    return parts.join("\n\n");
  }

  async generate_round_analysis(current_round: number) {
    if (current_round <= 1) {
      this.round_situation[current_round] = "";
      return "";
    }
    const prev = current_round - 1;
    const previous_experience = this._build_previous_experience(prev);
    let eventText = "";
    const e = this.round_events[prev];
    if (e) {
      const title = (e as any).event_title || (e as any).title || "";
      const desc = (e as any).event_description || (e as any).description || "";
      eventText = `${title} - ${desc}`.replace(/ -$/, "");
    }
    const getChoice = (role: RoleEnum) => {
      const actions = this.round_actions[prev] || [];
      const found = actions.find((a) => a.role === role);
      return found?.action || "";
    };
    let prompt = P3;
    prompt = prompt.replace("{background}", this.background || "");
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
    this.round_situation[current_round] = analysis;
    return analysis;
  }

  private _validate_event_response(resp: any) {
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

  private _get_default_event(round_num: number): GeneratedEvent {
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

  calculate_game_result(): GameResult {
    const base_score = 50;
    const user_growth = randInt(1000, 100000);
    const revenue = randInt(10000, 1000000);
    const market_share = randInt(1, 25);
    const team_size = randInt(5, 100);
    const total_actions = Object.values(this.round_actions).reduce(
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
    const player_performance = this._calculate_player_performance();
    const playerScores: Record<string, number> = {};
    for (const perf of player_performance)
      playerScores[String(perf.player)] = Math.min(
        50 + Number(perf.contribution_score || 0),
        100
      );
    let final_report = "";
    try {
      final_report = this.generate_final_report();
    } catch {
      final_report = "报告生成失败，请稍后重试。";
    }
    return {
      final_score,
      success_level,
      metrics: { user_growth, revenue, market_share, team_size },
      achievements: this._generate_achievements(final_score),
      timeline: this._generate_timeline(),
      player_performance,
      playerScores,
      final_report,
    };
  }

  private _generate_achievements(score: number) {
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

  private _generate_timeline() {
    return [
      { round: 1, event: "产品原型开发完成", impact: "positive" },
      { round: 2, event: "获得首批用户", impact: "positive" },
      { round: 3, event: "完成A轮融资", impact: "positive" },
      { round: 4, event: "市场竞争加剧", impact: "negative" },
      { round: 5, event: "战略合作达成", impact: "positive" },
    ];
  }

  private _calculate_player_performance() {
    const perf: Array<Record<string, any>> = [];
    for (const p of this.players) {
      const action_count = Object.values(this.round_actions).reduce(
        (s, arr) =>
          s +
          arr.filter((a) => a.player === p.name || a.playerName === p.name)
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

  generate_final_report() {
    const outputs: string[] = [];
    for (let round = 1; round <= 5; round++) {
      const parts: string[] = [];
      const sit = this.round_situation[round];
      if (sit)
        parts.push(
          `第${round}轮情况：${
            typeof sit === "object"
              ? String((sit as any).impact || sit)
              : String(sit)
          }`
        );
      const ev = this.round_events[round];
      if (ev) {
        const title = (ev as any).event_title || (ev as any).title || "";
        const desc =
          (ev as any).event_description || (ev as any).description || "";
        parts.push(`事件：${`${title} - ${desc}`.replace(/ -$/, "")}`);
      }
      const actions = this.round_actions[round] || [];
      if (actions.length) {
        const summary = actions
          .map(
            (a) =>
              `${a.playerName || a.player}(${String(
                (a.role as any)?.toString?.() || a.role || ""
              )})：${a.action || ""}`
          )
          .join("\n");
        parts.push(`玩家决策：\n${summary}`);
      }
      outputs.push(parts.length ? parts.join("\n") : `第${round}轮：暂无数据`);
    }
    let prompt = P4.replace("{background}", this.background || "");
    prompt = prompt.replace("{output1}", outputs[0] || "暂无数据");
    prompt = prompt.replace("{output2}", outputs[1] || "暂无数据");
    prompt = prompt.replace("{output3}", outputs[2] || "暂无数据");
    prompt = prompt.replace("{output4}", outputs[3] || "暂无数据");
    prompt = prompt.replace("{output5}", outputs[4] || "暂无数据");
    // 替换角色姓名
    const ceo = this.players.find((p) => p.role === RoleEnum.CEO);
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
    for (const p of this.players)
      if (p.role && p.role !== RoleEnum.CEO)
        prompt = prompt.replace(
          `${map[p.role]}：[玩家姓名]`,
          `${map[p.role]}：${p.name}`
        );
    const overall = this._build_previous_experience(6) || "暂无之前经历";
    prompt = prompt.replace("{previous_experience}", overall);
    return new LLM().text(prompt, { temperature: 0.7 }) as unknown as string;
  }
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
