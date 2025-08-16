export enum MessageType {
  PLAYER_JOIN = "player_join",
  PLAYER_LEAVE = "player_leave",
  GAME_LOADING = "game_loading",
  GAME_START = "game_start",
  TRANSITION_ANIMATION = "transition_animation",
  GAME_STARTED = "game_started",
  IDEAS_COMPLETE = "ideas_complete",
  ROLE_SELECTED = "role_selected",
  ROLES_COMPLETE = "roles_complete",
  ROUND_LOADING = "round_loading",
  ROUND_START = "round_start",
  ROUND_PHASE = "round_phase",
  ROUND_TICK = "round_tick",
  ACTION_SUBMITTED = "action_submitted",
  ROUND_COMPLETE = "round_complete",
  GAME_COMPLETE = "game_complete",
  GAME_RESTART = "game_restart",
  CONNECTION_SUCCESS = "connection_success",
}

export enum GameState {
  LOBBY = "lobby",
  PLAYING = "playing",
  FINISHED = "finished",
}

// 回合阶段类型
export type RoundPhase =
  | "event_display"
  | "info_and_options"
  | "discussion"
  | null;

export enum RoleEnum {
  CEO = "CEO",
  CTO = "CTO",
  CMO = "CMO",
  COO = "COO",
}

export interface PlayerState {
  name: string;
  is_online: boolean;
  joined_at: string;
  role: RoleEnum;
  startup_idea: string;
  is_host: boolean;
  actions: Array<Record<string, unknown>>;
}

export interface DecisionEvent {
  event_title: string;
  event_description: string;
  decision_options: Record<string, string>;
}

export interface GeneratedEvent {
  situation?: string;
  event: DecisionEvent;
  private_messages: Record<string, string>;
  is_default_event?: boolean;
}

export interface GameResult {
  final_score: number;
  success_level: string;
  metrics: {
    user_growth: number;
    revenue: number;
    market_share: number;
    team_size: number;
  };
  achievements: string[];
  timeline: Array<{ round: number; event: string; impact: string }>;
  player_performance: Array<Record<string, unknown>>;
  playerScores: Record<string, number>;
  final_report: string;
}
