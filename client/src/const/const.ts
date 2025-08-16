/**
 * 游戏UX 页面枚举
 * 定义游戏的所有可能页面
 */
export const GAME_UX_PAGEING = {
  /** 初始状态 */
  INITIAL: "initial",
  /** 欢迎页面 */
  WELCOME: "welcome",
  /** 房间选择 */
  ROOM_SELECTION: "room_selection",
  /** 大厅 */
  LOBBY: "lobby",
  /** 加载 */
  LOADING: "loading",
  /** 回合加载 */
  ROUND_LOADING: "round_loading",
  /** 角色选择 */
  ROLE_SELECTION: "role_selection",
  /** 事件生成 */
  EVENT_GENERATION: "event_generation",
  /** 游戏进行中 */
  PLAYING: "playing",
  /** 回合结果 */
  ROUND_RESULT: "round_result",
  /** 游戏结果 */
  RESULT: "result",
} as const;

/**
 * 游戏状态类型
 */
export type GameState = (typeof GAME_UX_PAGEING)[keyof typeof GAME_UX_PAGEING];

/**
 * 服务器配置类型
 */
export interface ServerConfig {
  /** HTTP API基础URL */
  http: string;
  /** WebSocket基础URL */
  ws: string;
  /** 主机地址（可选） */
  host?: string;
  /** 端口号（可选） */
  port?: string;
}

/**
 * 玩家信息类型
 */
export interface Player {
  /** 玩家名称 */
  name: string;
  /** 是否在线 */
  online?: boolean;
  /** 是否为房主 */
  is_host?: boolean;
}

/**
 * 轮次事件类型
 */
export interface RoundEvent {
  /** 事件标题 */
  event_title: string;
  /** 事件描述 */
  event_description: string;
  /** 决策选项 */
  decision_options: Record<string, string>;
}

/**
 * 玩家行动类型
 */
export interface PlayerAction {
  /** 玩家名称 */
  playerName: string;
  /** 行动类型 */
  actionType: string;
  /** 行动内容 */
  action: string;
  /** 轮次编号 */
  round: number;
  /** 时间戳 */
  timestamp?: string;
}

/**
 * 游戏结果类型
 */
export interface GameResult {
  /** 最终报告 */
  report: string;
}

/**
 * 角色定义类型
 */
export interface RoleDefinition {
  /** 角色ID */
  id: string;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description: string;
}

/**
 * WebSocket消息类型
 */
export interface WebSocketMessage {
  /** 消息类型 */
  type: string;
  /** 消息数据 */
  data: Record<string, any>;
  /** 消息ID（可选） */
  id?: string;
  /** 时间戳（可选） */
  timestamp?: string;
}

/**
 * 房间状态类型
 */
export interface RoomStatus {
  /** 房间ID */
  room_id: string;
  /** 玩家数量 */
  player_count: number;
  /** 游戏状态 */
  state: string;
  /** 是否已满 */
  is_full: boolean;
}

/**
 * 房间信息类型
 */
export interface RoomInfo {
  /** 房间ID */
  room_id: string;
  /** 当前玩家数 */
  player_count: number;
  /** 最大玩家数 */
  max_players: number;
  /** 房间状态 */
  state: "prepare" | "playing";
  /** 玩家列表 */
  players: Player[];
}



