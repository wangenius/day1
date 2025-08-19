import { useCallback, useState } from "react";
import {
  GAME_UX_PAGEING,
  type GameResult,
  type GameState,
  type PlayerAction,
  type RoleDefinition,
  type RoundEvent,
} from "../../const/const";
import type { UseRoomReturn } from "./useRoom";
import type { UseWebSocketReturn } from "./useWebSocket";

/**
 * 游戏状态 Hook 参数接口
 */
export interface UseGameStateParams {
  /** 房间管理对象 */
  room: UseRoomReturn;
  /** WebSocket 管理对象 */
  webSocket: UseWebSocketReturn;
}

/**
 * 游戏状态 Hook 返回值接口
 * 定义了整个游戏应用中所有状态数据和操作方法
 */
export interface UseGameStateReturn {
  // ========== 基础状态 ==========
  /** 当前游戏的主要状态（如INITIAL、WELCOME、LOBBY、PLAYING等） */
  gameState: GameState;
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

  /** 重置所有游戏相关状态到初始值 */
  resetGameState: () => void;

  // ========== 事件处理函数 ==========
  handleRoomActionWithConnection: (
    action: string,
    roomId: string
  ) => Promise<void>;
  handleStartupIdeaSubmit: (idea: string) => void;
  handleRoleSelect: (roleId: string) => void;
  handleActionSubmit: (action: PlayerAction) => void;
  handleStartRound: () => void;
  handleLoadingComplete: () => void;
  handleRestartGame: () => void;
  goToSelection: () => void;
  goToInfoAndOptions: () => void;
  goToDiscussion: () => void;
  selectAction: (actionKey: string) => void;
  submitSelectedAction: () => void;
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
 * @param params - Hook所需的参数对象
 * @returns 返回所有状态数据和操作方法的对象
 *
 * @example
 * ```tsx
 * const gameState = useGameState(params);
 *
 * // 使用状态
 * const { currentRound, roundEvent, gameState: currentState } = gameState;
 *
 * // 更新状态
 * gameState.setCurrentRound(2);
 * gameState.setGameState(GAME_UX_PAGEING.PLAYING);
 * ```
 */
export function useGameState(params: UseGameStateParams): UseGameStateReturn {
  const { room, webSocket } = params;

  // ==================== 基础状态 ====================
  /** 当前游戏状态 */
  const [gameState, setGameState] = useState<GameState>(
    GAME_UX_PAGEING.IDEA_INPUT
  );

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

  /**
   * 重置游戏状态
   * 将所有游戏相关状态重置为初始值
   */
  const resetGameState = useCallback((): void => {
    setGameState(GAME_UX_PAGEING.IDEA_INPUT);
    setCurrentRound(1);
    setRoundEvent(null);
    setPrivateMessages({});
    setPlayerActions([]);
    setGameResult(null);
    setSelectedRoles([]);
    setWaitingForPlayers(false);
    setGameBackground(null);
    setRoleDefinitions(null);
  }, []);

  /**
   * 处理房间操作（创建或加入房间）- 包装版，包含WebSocket连接
   * @param action - 操作类型
   * @param roomId - 房间ID
   */
  const handleRoomActionWithConnection = useCallback(
    async (action: string, roomId: string): Promise<void> => {
      try {
        console.log(
          `🏠 步骤1: 开始房间操作流程，操作类型: ${action}, 房间ID: ${roomId}`
        );

        // 步骤1: 先执行HTTP API调用加入房间
        console.log(`🏠 步骤1: 调用API加入房间`);
        await room.join(roomId);
        console.log(`🏠 步骤1: API调用成功，房间加入完成`);

        // 步骤2: API成功后建立WebSocket实时连接
        console.log(`🏠 步骤2: 开始建立WebSocket连接`);
        console.log(
          `🏠 步骤2: 连接参数 - 玩家: ${room.player}, 房间: ${roomId}`
        );
        webSocket.connect(room.player, roomId);
        console.log(`🏠 步骤2: WebSocket连接建立请求已发送`);

        console.log(`🏠 完成: 房间操作流程完成，等待WebSocket连接确认`);
      } catch (error) {
        // 异常处理: 错误已在handleRoomAction中处理并显示，这里记录日志
        console.log(`🏠 异常处理: 房间操作失败`, error);
        console.error("🏠 详细错误信息:", error);
        // 不重新抛出错误，因为用户已经收到错误提示
      }
    },
    [room, webSocket]
  );

  /**
   * 处理创业想法提交
   * @param idea - 玩家提交的创业想法
   */
  const handleStartupIdeaSubmit = useCallback(
    (idea: string): void => {
      if (webSocket.connected) {
        webSocket.send({
          type: "startup_idea",
          data: { idea },
        });
      }
    },
    [webSocket]
  );

  /**
   * 处理角色选择
   * @param roleId - 选择的角色ID
   */
  const handleRoleSelect = useCallback(
    (roleId: string): void => {
      console.log(`🎭 步骤开始: 处理角色选择，角色ID: ${roleId}`);
      console.log(`🎭 步骤开始: WebSocket连接状态: ${webSocket.connected}`);

      // 步骤1: 更新全局已选择的角色列表
      console.log(`🎭 步骤1: 开始更新已选择角色列表`);
      setSelectedRoles((prevRoles: string[]) => {
        const newRoles = [...prevRoles, roleId];
        console.log(`🎭 步骤1: 已选择角色列表更新:`, {
          previous: prevRoles,
          new: newRoles,
          added: roleId,
        });
        return newRoles;
      });

      // 步骤2: 检查WebSocket连接状态并发送选择消息到服务器
      if (webSocket.connected) {
        console.log(`🎭 步骤2: WebSocket连接正常，准备发送角色选择消息`);

        // 步骤2.1: 构造消息对象
        const message = {
          type: "select_role",
          data: { role: roleId },
        };
        console.log(`🎭 步骤2.1: 构造消息对象:`, message);

        // 步骤2.2: 发送消息到服务器
        console.log(`🎭 步骤2.2: 发送角色选择消息到服务器`);
        webSocket.send(message);
        console.log(`🎭 步骤2.2: 消息发送完成`);

        console.log(`🎭 完成: 角色选择流程完成，等待服务器确认`);
      } else {
        // 步骤2.alt: WebSocket未连接的错误处理
        console.error(`🎭 步骤2.alt: WebSocket未连接，无法发送角色选择消息`);
        console.error(
          `🎭 步骤2.alt: 连接状态 - 已连接: ${webSocket.connected}`
        );
        // 注意: 本地状态已更新，如果连接恢复，可以通过状态同步机制处理
      }
    },
    [webSocket, setSelectedRoles]
  );

  /**
   * 处理游戏行动提交
   * @param action - 玩家的行动数据
   */
  const handleActionSubmit = useCallback(
    (action: PlayerAction): void => {
      if (webSocket.connected) {
        webSocket.send({
          type: "game_action",
          data: action,
        });
      }
    },
    [webSocket]
  );

  /**
   * 处理开始轮次
   * 从加载状态切换到游戏中状态
   */
  const handleStartRound = useCallback((): void => {
    setGameState(GAME_UX_PAGEING.PLAYING);
  }, [setGameState]);

  /**
   * 处理加载完成后开始游戏
   * 设置初始轮次并开始游戏
   */
  const handleLoadingComplete = useCallback((): void => {
    setGameState(GAME_UX_PAGEING.PLAYING);
  }, [setGameState]);

  /**
   * 处理重新开始游戏
   * 如果有WebSocket连接则发送重启消息，否则本地重置
   */
  const handleRestartGame = useCallback((): void => {
    if (webSocket.connected) {
      webSocket.send({ type: "restart_game", data: {} });
    } else {
      resetGameState();
    }
  }, [webSocket, resetGameState]);

  // ==================== 前端阶段控制方法 ====================

  /**
   * 切换到选择阶段
   */
  const goToSelection = useCallback((): void => {
    setCurrentPhase(UI_GAME_PHASES.SELECTION);
  }, [setCurrentPhase, UI_GAME_PHASES.SELECTION]);

  /**
   * 切换到信息与选项阶段
   */
  const goToInfoAndOptions = useCallback((): void => {
    setCurrentPhase(UI_GAME_PHASES.INFO_AND_OPTIONS);
  }, [setCurrentPhase, UI_GAME_PHASES.INFO_AND_OPTIONS]);

  /**
   * 切换到讨论阶段
   */
  const goToDiscussion = useCallback((): void => {
    setCurrentPhase(UI_GAME_PHASES.DISCUSSION);
  }, [setCurrentPhase, UI_GAME_PHASES.DISCUSSION]);

  /**
   * 选择某个选项
   * @param actionKey - 选项键
   */
  const selectAction = useCallback(
    (actionKey: string): void => {
      setSelectedAction(actionKey);
    },
    [setSelectedAction]
  );

  /**
   * 提交当前选择
   */
  const submitSelectedAction = useCallback((): void => {
    if (!selectedAction) return;
    const action: PlayerAction = {
      playerName: room.player,
      actionType: "decision",
      action: selectedAction,
      round: currentRound,
      timestamp: new Date().toISOString(),
    };
    handleActionSubmit(action);
    setHasSubmitted(true);
  }, [
    selectedAction,
    room.player,
    currentRound,
    handleActionSubmit,
    setHasSubmitted,
  ]);

  return {
    // ========== 基础状态 ==========
    gameState,

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

    // ========== 前端阶段与交互状态 ==========
    currentPhase,
    timeLeft,
    selectedAction,
    hasSubmitted,
    showPrivateModal,
    showEventModal,

    // ========== 状态更新函数 ==========
    setGameState,
    setCurrentRound,
    setRoundEvent,
    setPrivateMessages,
    setPlayerActions,
    setGameResult,
    setSelectedRoles,
    setWaitingForPlayers,
    setGameBackground,
    setRoleDefinitions,
    setCurrentPhase,
    setTimeLeft,
    setSelectedAction,
    setHasSubmitted,
    setShowPrivateModal,
    setShowEventModal,
    resetGameState,
    handleRoomActionWithConnection,
    handleStartupIdeaSubmit,
    handleRoleSelect,
    handleActionSubmit,
    handleStartRound,
    handleLoadingComplete,
    handleRestartGame,
    goToSelection,
    goToInfoAndOptions,
    goToDiscussion,
    selectAction,
    submitSelectedAction,
  };
}
