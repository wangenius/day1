/** 房间状态
 * 1. 准备: 此时玩家可以加入房间(未开始游戏)
 * 2. 进行中: 此时游戏进行中，每轮游戏有且仅有一个状态，状态会根据当前轮次变化
 *
 * 只有准备中的时候房间可以加入玩家，其他时候不可以加入玩家。
 */
export enum RoomState {
  /** 准备 */
  PREPARE = "prepare",
  /** 进行中 */
  PLAYING = "playing",
}

/** 游戏状态
 * 1. 游戏进行中: 此时游戏进行中，每轮游戏有且仅有一个状态，状态会根据当前轮次变化
 * 2. 游戏结束: 此时游戏结束
 */
export enum GameState {
  /** 游戏进行中*/
  PLAYING = "playing",
  /** 游戏结束 */
  FINISHED = "finished",
}

/** 角色，玩家可以选择的4种角色，每个玩家只能选择一个角色 */
export enum RoleEnum {
  CEO = "CEO",
  CTO = "CTO",
  CMO = "CMO",
  COO = "COO",
}

/** 当一个玩家加入一个房间后，会拥有一个玩家信息卡，注意，每个房间中的玩家名称不能重复，否则无法加入该房间
 */
export interface PlayerInfo {
  /** 玩家名称 */
  name: string;
  /** 是否在线 */
  is_online: boolean;
  /** 是否为房主 */
  is_host: boolean;
}

export interface GameInfo {
  /** 游戏状态 */
  state: GameState;
  /** 游戏结果 */
  result: GameResult;
  /** 创业想法 */
  ideas: Record<string, string>;
  /**
   * 确定的想法
   */
  selected_idea: string;
  /** 玩家对应的角色 */
  roles: Record<string, RoleEnum>;
  /** 背景 */
  background: string;
  /** 轮次 */
  rounds: Record<number, RoundInfo>;
  /** 当前轮次 */
  current_round: number;
}

export interface RoundInfo {
  /** 轮次情况 */
  situation: string;
  /** 轮次决策选项: ABC */
  decision_options: Record<string, string>;
  /** 轮次私人消息: 每个玩家对应一条私人消息 */
  private_messages: Record<string, string>;
  /** 玩家行动记录 */
  player_actions: Record<string, string>;
  /** 轮次剩余时间 */
  phase_remain: number;
}

/** 游戏结果: 目前仅有一个字段即最终报告，最终报告是根据每轮的决策和情况生成的 */
export interface GameResult {
  /** 最终报告 */
  report: string;
}
