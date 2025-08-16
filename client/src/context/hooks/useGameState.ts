import { useState, useCallback } from "react";
import {
  GAME_UX_PAGEING,
  type GameState,
  type Player,
  type RoundEvent,
  type PlayerAction,
  type GameResult,
  type RoleDefinition,
  type RoomInfo,
} from "../../const/const";

/**
 * 游戏状态 Hook 返回值接口
 * 定义了整个游戏应用中所有状态数据和操作方法
 */
interface UseGameStateReturn {
  // ========== 基础状态 ==========
  /** 当前游戏的主要状态（如INITIAL、WELCOME、LOBBY、PLAYING等） */
  gameState: GameState;
  /** 当前登录的玩家名称 */
  playerName: string;
  /** 当前所在房间的唯一标识符 */
  currentRoom: string;
  /** 房间内所有玩家的信息列表 */
  players: Player[];
  /** WebSocket连接的状态标志 */
  wsConnected: boolean;

  // ========== 游戏相关状态 ==========
  /** 当前游戏进行的轮次编号（1-5轮） */
  currentRound: number;
  /** 当前轮次的事件信息，包含事件描述和选项 */
  roundEvent: RoundEvent | null;
  /** 各玩家的私人消息映射表，键为玩家名，值为私人消息内容 */
  privateMessages: Record<string, string>;
  /** 所有玩家在各轮次的行动记录列表 */
  playerActions: PlayerAction[];
  /** 游戏结束时的最终结果数据 */
  gameResult: GameResult | null;
  /** 已被选择的角色列表，用于避免重复选择 */
  selectedRoles: string[];
  /** 是否正在等待其他玩家完成操作的状态标志 */
  waitingForPlayers: boolean;
  /** 游戏的背景故事文本 */
  gameBackground: string | null;
  /** 动态生成的角色定义数据，键为角色ID，值为角色详细信息 */
  roleDefinitions: Record<string, RoleDefinition> | null;
  /** 当前可用的房间列表数据 */
  roomList: RoomInfo[];
  /** 是否正在加载房间列表的状态标志 */
  loadingRoomList: boolean;

  // ========== 前端阶段与交互状态 ==========
  /** 当前前端UI显示的阶段（事件展示、选项、讨论、选择等） */
  currentPhase: string;
  /** 当前阶段的剩余时间（秒），用于倒计时显示 */
  timeLeft: number;
  /** 当前玩家选择的行动选项键值 */
  selectedAction: string;
  /** 当前玩家是否已提交选择的状态标志 */
  hasSubmitted: boolean;
  /** 是否显示私人信息弹窗的状态标志 */
  showPrivateModal: boolean;
  /** 是否显示事件详情弹窗的状态标志 */
  showEventModal: boolean;

  // ========== 状态更新函数 ==========
  /** 设置主游戏状态 */
  setGameState: (state: GameState) => void;
  /** 设置玩家名称 */
  setPlayerName: (name: string) => void;
  /** 设置当前房间ID */
  setCurrentRoom: (room: string) => void;
  /** 设置玩家列表，支持直接设置或使用更新函数 */
  setPlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void;
  /** 设置WebSocket连接状态 */
  setWsConnected: (connected: boolean) => void;
  /** 设置当前轮次 */
  setCurrentRound: (round: number) => void;
  /** 设置当前轮次事件 */
  setRoundEvent: (event: RoundEvent | null) => void;
  /** 设置私人消息映射表 */
  setPrivateMessages: (messages: Record<string, string>) => void;
  /** 设置玩家行动列表 */
  setPlayerActions: (actions: PlayerAction[]) => void;
  /** 设置游戏结果 */
  setGameResult: (result: GameResult | null) => void;
  /** 设置已选择角色列表，支持直接设置或使用更新函数 */
  setSelectedRoles: (roles: string[] | ((prev: string[]) => string[])) => void;
  /** 设置是否等待其他玩家状态 */
  setWaitingForPlayers: (waiting: boolean) => void;
  /** 设置游戏背景故事 */
  setGameBackground: (background: string | null) => void;
  /** 设置角色定义数据 */
  setRoleDefinitions: (roles: Record<string, RoleDefinition> | null) => void;
  /** 设置房间列表 */
  setRoomList: (rooms: RoomInfo[]) => void;
  /** 设置房间列表加载状态 */
  setLoadingRoomList: (loading: boolean) => void;
  /** 设置当前UI阶段 */
  setCurrentPhase: (phase: string) => void;
  /** 设置剩余时间 */
  setTimeLeft: (time: number) => void;
  /** 设置当前选择的行动 */
  setSelectedAction: (action: string) => void;
  /** 设置是否已提交状态 */
  setHasSubmitted: (submitted: boolean) => void;
  /** 设置是否显示私人信息弹窗 */
  setShowPrivateModal: (show: boolean) => void;
  /** 设置是否显示事件详情弹窗 */
  setShowEventModal: (show: boolean) => void;

  // ========== 工具函数 ==========
  /**
   * 规范化服务器返回的玩家数据格式
   * @param arr - 服务器返回的原始玩家数据数组
   * @returns 规范化后的Player数组
   */
  normalizePlayersPayload: (arr: any[]) => Player[];
  /**
   * 规范化服务器返回的房间数据格式
   * @param rooms - 服务器返回的原始房间数据数组
   * @returns 规范化后的RoomInfo数组
   */
  normalizeRoomsPayload: (rooms: any[]) => RoomInfo[];
  /**
   * 保存游戏状态到本地存储
   * @param playerName - 玩家名称（可选）
   * @param roomId - 房间ID（可选）
   * @param gameState - 游戏状态（可选）
   */
  saveGameState: (
    playerName?: string | null,
    roomId?: string | null,
    gameState?: GameState | null
  ) => void;
  /** 重置所有游戏相关状态到初始值 */
  resetGameState: () => void;
}

/**
 * 游戏状态管理 Hook
 *
 * 这是整个游戏应用的核心状态管理 Hook，集中管理所有游戏相关的状态数据。
 * 它提供了游戏从开始到结束整个流程中需要的所有状态变量和状态操作方法。
 *
 * 主要功能：
 * - 管理游戏基础状态（当前状态、玩家信息、房间信息等）
 * - 管理游戏进行状态（轮次、事件、行动、结果等）
 * - 管理前端UI状态（阶段、弹窗、倒计时等）
 * - 提供数据规范化和本地存储功能
 * - 提供系统消息管理功能
 *
 * 设计特点：
 * - 采用单一状态源原则，所有状态都在这里集中管理
 * - 提供完整的状态更新方法，支持函数式更新
 * - 包含工具函数，处理数据转换和持久化
 * - 状态分类清晰，便于理解和维护
 *
 * @returns 返回所有状态数据和操作方法的对象
 *
 * @example
 * ```tsx
 * const gameState = useGameState();
 *
 * // 使用状态
 * const { playerName, currentRoom, gameState: currentState } = gameState;
 *
 * // 更新状态
 * gameState.setPlayerName('NewPlayer');
 * gameState.setGameState(GAME_STATES.PLAYING);
 *
 * // 使用工具函数
 * gameState.addMessage('游戏开始了！');
 * gameState.saveGameState('player1', 'room123', GAME_STATES.LOBBY);
 * ```
 */
export function useGameState(): UseGameStateReturn {
  // ==================== 基础状态 ====================
  /** 当前游戏状态 */
  const [gameState, setGameState] = useState<GameState>(
    GAME_UX_PAGEING.INITIAL
  );
  /** 当前玩家名称 */
  const [playerName, setPlayerName] = useState<string>("");
  /** 当前房间ID */
  const [currentRoom, setCurrentRoom] = useState<string>("");
  /** 房间内所有玩家列表 */
  const [players, setPlayers] = useState<Player[]>([]);
  /** WebSocket连接状态 */
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // ==================== 游戏相关状态 ====================
  /** 当前游戏轮次 */
  const [currentRound, setCurrentRound] = useState<number>(1);
  /** 当前轮次的事件信息 */
  const [roundEvent, setRoundEvent] = useState<RoundEvent | null>(null);
  /** 玩家私人消息，key为玩家名，value为消息内容 */
  const [privateMessages, setPrivateMessages] = useState<
    Record<string, string>
  >({});
  /** 玩家行动列表，存储所有玩家的行动记录 */
  const [playerActions, setPlayerActions] = useState<PlayerAction[]>([]);
  /** 游戏结果数据 */
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  /** 已选择的角色列表 */
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  /** 是否正在等待其他玩家 */
  const [waitingForPlayers, setWaitingForPlayers] = useState<boolean>(false);
  /** 游戏背景故事 */
  const [gameBackground, setGameBackground] = useState<string | null>(null);
  /** 角色定义数据 */
  const [roleDefinitions, setRoleDefinitions] = useState<Record<
    string,
    RoleDefinition
  > | null>(null);
  /** 房间列表数据 */
  const [roomList, setRoomList] = useState<RoomInfo[]>([]);
  /** 是否正在加载房间列表 */
  const [loadingRoomList, setLoadingRoomList] = useState<boolean>(false);

  // ==================== 前端阶段与交互状态 ====================
  const UI_GAME_PHASES = {
    EVENT_DISPLAY: "event_display",
    INFO_AND_OPTIONS: "info_and_options",
    DISCUSSION: "discussion",
    SELECTION: "selection",
  } as const;

  /** 当前前端阶段 */
  const [currentPhase, setCurrentPhase] = useState<string>(
    UI_GAME_PHASES.EVENT_DISPLAY
  );
  /** 讨论倒计时（秒） */
  const [timeLeft, setTimeLeft] = useState<number>(180);
  /** 当前选择的选项键 */
  const [selectedAction, setSelectedAction] = useState<string>("");
  /** 是否已提交（与服务端同步） */
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  /** 私人信息弹窗 */
  const [showPrivateModal, setShowPrivateModal] = useState<boolean>(false);
  /** 事件详情弹窗 */
  const [showEventModal, setShowEventModal] = useState<boolean>(false);

  // ==================== 工具函数 ====================

  /**
   * 将服务端玩家payload规范化为前端 Player 类型
   */
  const normalizePlayersPayload = useCallback((arr: any[]): Player[] => {
    console.log(`🔄 步骤开始: 规范化玩家数据`);
    console.log(`🔄 步骤开始: 输入数据:`, arr);

    // 步骤1: 验证输入数据类型
    if (!Array.isArray(arr)) {
      console.log(`🔄 步骤1: 输入不是数组，返回空数组`);
      return [];
    }
    console.log(`🔄 步骤1: 输入验证通过，数组长度: ${arr.length}`);

    // 步骤2: 逐个转换玩家数据
    console.log(`🔄 步骤2: 开始转换玩家数据`);
    const normalizedPlayers = arr.map((p, index) => {
      console.log(`🔄 步骤2.${index + 1}: 转换玩家数据:`, p);

      const player = {
        name: p?.name ?? "",
        online: p?.is_online ?? p?.online ?? false,
        role: p?.role ?? undefined,
        idea: p?.startup_idea ?? p?.idea ?? undefined,
        isHost: p?.isHost ?? p?.is_host ?? false,
      };

      console.log(`🔄 步骤2.${index + 1}: 转换完成:`, player);
      return player;
    });

    console.log(
      `🔄 完成: 玩家数据规范化完成，共 ${normalizedPlayers.length} 个玩家`
    );
    return normalizedPlayers;
  }, []);

  /**
   * 将服务端房间列表规范化为前端 RoomInfo 类型
   */
  const normalizeRoomsPayload = useCallback((rooms: any[]): RoomInfo[] => {
    if (!Array.isArray(rooms)) return [] as RoomInfo[];
    return rooms.map((r) => ({
      room_id: r?.room_id ?? r?.id ?? "",
      player_count: r?.player_count ?? 0,
      max_players: r?.max_players ?? 4,
      state: r?.state ?? r?.room_state ?? "lobby",
      created_at: r?.created_at ?? null,
      players: Array.isArray(r?.players)
        ? r.players.map((p: any) => ({
            name: p?.name ?? "",
            is_host: p?.is_host ?? p?.isHost ?? false,
          }))
        : [],
    }));
  }, []);

  /**
   * 保存游戏状态到本地存储
   * @param savedPlayerName - 玩家名称
   * @param roomId - 房间ID
   * @param savedGameState - 游戏状态
   */
  const saveGameState = useCallback(
    (
      savedPlayerName?: string | null,
      roomId?: string | null,
      savedGameState?: GameState | null
    ): void => {
      if (savedPlayerName)
        localStorage.setItem("startup_player_name", savedPlayerName);
      if (roomId) localStorage.setItem("startup_room_id", roomId);
      if (savedGameState)
        localStorage.setItem("startup_game_state", savedGameState);
    },
    []
  );

  /**
   * 重置游戏状态
   * 将所有游戏相关状态重置为初始值
   */
  const resetGameState = useCallback((): void => {
    setGameState(GAME_UX_PAGEING.LOBBY);
    setCurrentRound(1);
    setRoundEvent(null);
    setPrivateMessages({});
    setPlayerActions([]);
    setGameResult(null);
    setSelectedRoles([]);
    setWaitingForPlayers(false);
    setGameBackground(null);
    setRoleDefinitions(null);
    setRoomList([]);
    setLoadingRoomList(false);
    saveGameState(playerName, currentRoom, GAME_UX_PAGEING.LOBBY);
  }, [playerName, currentRoom, saveGameState]);

  return {
    // ========== 基础状态 ==========
    gameState,
    playerName,
    currentRoom,
    players,
    wsConnected,

    // ========== 游戏相关状态 ==========
    currentRound,
    roundEvent,
    privateMessages,
    playerActions,
    gameResult,
    selectedRoles,
    waitingForPlayers,
    gameBackground,
    roleDefinitions,
    roomList,
    loadingRoomList,

    // ========== 前端阶段与交互状态 ==========
    currentPhase,
    timeLeft,
    selectedAction,
    hasSubmitted,
    showPrivateModal,
    showEventModal,

    // ========== 状态更新函数 ==========
    setGameState,
    setPlayerName,
    setCurrentRoom,
    setPlayers,
    setWsConnected,
    setCurrentRound,
    setRoundEvent,
    setPrivateMessages,
    setPlayerActions,
    setGameResult,
    setSelectedRoles,
    setWaitingForPlayers,
    setGameBackground,
    setRoleDefinitions,
    setRoomList,
    setLoadingRoomList,
    setCurrentPhase,
    setTimeLeft,
    setSelectedAction,
    setHasSubmitted,
    setShowPrivateModal,
    setShowEventModal,

    // ========== 工具函数 ==========
    normalizePlayersPayload,
    normalizeRoomsPayload,
    saveGameState,
    resetGameState,
  };
}
