import { useCallback } from "react";
import {
  GAME_UX_PAGEING,
  type GameState,
  type Player,
  type PlayerAction,
  type RoundEvent,
  type GameResult,
  type RoleDefinition,
  type RoomInfo,
} from "../../const/const";

/**
 * 游戏事件处理器 Hook 参数接口
 * 定义了 useGameHandlers Hook 所需的所有参数，包括游戏状态、UI控制和各种回调函数
 */
interface UseGameHandlersParams {
  // ========== 基础游戏数据 ==========
  /** 当前登录的玩家名称，用于标识玩家身份 */
  playerName: string;
  /** 当前所在房间的唯一标识符 */
  currentRoom: string;
  /** 当前游戏进行的轮次编号（从1开始） */
  currentRound: number;
  /** WebSocket 连接的引用对象，用于发送消息给服务器 */
  wsRef: React.MutableRefObject<WebSocket | null>;
  /** WebSocket 连接状态标志，指示是否已成功连接到服务器 */
  wsConnected: boolean;

  /** HTTP API 服务器的基础URL地址，用于房间状态检查等HTTP请求 */
  httpBaseUrl: string;

  // ========== UI 状态相关 ==========
  /** 当前玩家选择的行动/选项的键值 */
  selectedAction: string;
  /** UI游戏阶段的常量定义，用于控制前端显示的不同阶段 */
  UI_GAME_PHASES: {
    /** 事件展示阶段 */
    EVENT_DISPLAY: string;
    /** 信息和选项阶段 */
    INFO_AND_OPTIONS: string;
    /** 讨论阶段 */
    DISCUSSION: string;
    /** 选择阶段 */
    SELECTION: string;
  };

  // ========== 状态更新函数 ==========
  /**
   * 设置主游戏状态的函数
   * @param state - 新的游戏状态（如LOBBY、PLAYING、RESULT等）
   */
  setGameState: (state: GameState) => void;
  /**
   * 设置玩家名称的函数
   * @param name - 新的玩家名称
   */
  setPlayerName: (name: string) => void;
  /**
   * 设置房间内玩家列表的函数，支持直接设置或使用更新函数
   * @param players - 新的玩家数组或更新函数
   */
  setPlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void;
  /**
   * 设置已选择角色列表的函数，支持直接设置或使用更新函数
   * @param roles - 新的角色数组或更新函数
   */
  setSelectedRoles: (roles: string[] | ((prev: string[]) => string[])) => void;
  /**
   * 设置当前UI阶段的函数
   * @param phase - 新的阶段标识符
   */
  setCurrentPhase: (phase: string) => void;
  /**
   * 设置当前选择行动的函数
   * @param action - 新的行动选项键值
   */
  setSelectedAction: (action: string) => void;
  /**
   * 设置是否已提交的状态函数
   * @param submitted - 是否已提交选择
   */
  setHasSubmitted: (submitted: boolean) => void;
  /**
   * 设置当前房间ID的函数
   * @param room - 新的房间标识符
   */
  setCurrentRoom: (room: string) => void;
  /**
   * 设置WebSocket连接状态的函数
   * @param connected - 是否已连接
   */
  setWsConnected: (connected: boolean) => void;
  /**
   * 设置当前轮次的函数
   * @param round - 新的轮次编号
   */
  setCurrentRound: (round: number) => void;
  /**
   * 设置当前轮次事件的函数
   * @param event - 新的轮次事件或null
   */
  setRoundEvent: (event: RoundEvent | null) => void;
  /**
   * 设置私人消息映射表的函数
   * @param messages - 新的私人消息映射表
   */
  setPrivateMessages: (messages: Record<string, string>) => void;
  /**
   * 设置玩家行动列表的函数
   * @param actions - 新的玩家行动列表
   */
  setPlayerActions: (actions: PlayerAction[]) => void;
  /**
   * 设置游戏结果的函数
   * @param result - 新的游戏结果或null
   */
  setGameResult: (result: GameResult | null) => void;
  /**
   * 设置是否等待其他玩家状态的函数
   * @param waiting - 是否等待其他玩家
   */
  setWaitingForPlayers: (waiting: boolean) => void;
  /**
   * 设置游戏背景故事的函数
   * @param background - 新的游戏背景故事或null
   */
  setGameBackground: (background: string | null) => void;
  /**
   * 设置角色定义数据的函数
   * @param roles - 新的角色定义数据或null
   */
  setRoleDefinitions: (roles: Record<string, RoleDefinition> | null) => void;
  /**
   * 设置房间列表的函数
   * @param rooms - 新的房间列表
   */
  setRoomList: (rooms: RoomInfo[]) => void;
  /**
   * 设置房间列表加载状态的函数
   * @param loading - 是否正在加载房间列表
   */
  setLoadingRoomList: (loading: boolean) => void;

  /** 重置游戏状态到初始值的函数 */
  resetGameState: () => void;

  // ========== API 函数 ==========
  /**
   * 处理房间操作的异步函数（来自 useGameAPI Hook）
   * @param action - 操作类型
   * @param roomId - 房间ID
   * @returns Promise 异步操作结果
   */
  handleRoomAction: (action: string, roomId: string) => Promise<void>;
  /**
   * 建立WebSocket连接的函数（来自 useWebSocket Hook）
   * @param player - 玩家名称
   * @param roomId - 房间ID
   */
  connectWebSocket: (player: string, roomId: string) => void;
}

/**
 * 游戏事件处理器 Hook 返回值接口
 * 定义了所有游戏事件处理方法，包括基础事件处理和前端阶段控制
 */
interface UseGameHandlersReturn {
  // ========== 基础事件处理方法 ==========
  /**
   * 处理首页点击事件
   * 从初始页面进入欢迎页面，开始游戏流程
   */
  handleInitialPageClick: () => void;
  /**
   * 处理玩家名称设置
   * 保存玩家名称并进入房间选择页面
   * @param name - 玩家输入的名称
   */
  handlePlayerNameSet: (name: string) => void;
  /**
   * 处理房间操作（包装版，包含WebSocket连接）
   * 先执行API加入房间，成功后自动建立WebSocket连接
   * @param action - 操作类型（join等）
   * @param roomId - 目标房间ID
   * @returns Promise 异步操作结果
   */
  handleRoomActionWithConnection: (
    action: string,
    roomId: string
  ) => Promise<void>;
  /**
   * 处理创业想法提交
   * 向服务器发送玩家的创业想法
   * @param idea - 玩家输入的创业想法
   */
  handleStartupIdeaSubmit: (idea: string) => void;
  /**
   * 处理角色选择
   * 处理玩家选择角色的操作，包括本地状态更新和服务器同步
   * @param roleId - 选择的角色标识符
   */
  handleRoleSelect: (roleId: string) => void;
  /**
   * 处理游戏行动提交
   * 向服务器提交玩家在游戏中的决策行动
   * @param action - 包含玩家行动信息的对象
   */
  handleActionSubmit: (action: PlayerAction) => void;

  /**
   * 处理开始轮次
   * 从加载状态切换到正式游戏状态，开始新轮次
   */
  handleStartRound: () => void;
  /**
   * 处理加载完成后开始游戏
   * 游戏初始化完成后开始第一轮游戏
   */
  handleLoadingComplete: () => void;
  /**
   * 处理重新开始游戏
   * 重置游戏状态，如果有WebSocket连接则通知服务器重启
   */
  handleRestartGame: () => void;
  /**
   * 处理退出房间
   * 安全退出当前房间，包括发送退出消息、关闭连接、清理状态
   */
  handleExitRoom: () => void;

  // ========== 前端阶段控制方法 ==========
  /**
   * 切换到选择阶段
   * 进入玩家可以做出决策选择的阶段
   */
  goToSelection: () => void;
  /**
   * 切换到信息与选项阶段
   * 显示事件信息和可选行动的阶段
   */
  goToInfoAndOptions: () => void;
  /**
   * 切换到讨论阶段
   * 进入玩家可以讨论的阶段（可能包含倒计时）
   */
  goToDiscussion: () => void;
  /**
   * 选择某个选项
   * 设置当前选择的行动选项（不立即提交）
   * @param actionKey - 选项的键值标识符
   */
  selectAction: (actionKey: string) => void;
  /**
   * 提交当前选择
   * 将当前选择的行动提交给服务器，并标记为已提交状态
   */
  submitSelectedAction: () => void;
}

/**
 * 游戏事件处理器 Hook
 *
 * 这个 Hook 集中管理游戏中所有用户交互事件的处理逻辑，
 * 包括页面导航、玩家操作、WebSocket消息发送等。
 * 它是游戏前端逻辑的核心控制器，协调各种状态更新和服务器通信。
 *
 * 主要功能：
 * - 处理游戏流程中的各种用户操作
 * - 管理前端阶段的切换和控制
 * - 协调本地状态更新和服务器同步
 * - 处理房间进入/退出逻辑
 * - 管理WebSocket消息发送
 *
 * @param params - Hook所需的参数对象，包含状态、回调函数等
 * @returns 返回所有事件处理方法的对象
 *
 * @example
 * ```tsx
 * const gameHandlers = useGameHandlers({
 *   playerName: 'Player1',
 *   currentRoom: 'room123',
 *   wsRef,
 *   wsConnected,
 *   // ... 其他参数
 * });
 *
 * // 使用事件处理器
 * gameHandlers.handlePlayerNameSet('NewPlayer');
 * gameHandlers.handleRoomActionWithConnection('join', 'room456');
 * ```
 */
export function useGameHandlers(
  params: UseGameHandlersParams
): UseGameHandlersReturn {
  const {
    playerName,
    currentRoom,
    currentRound,
    wsRef,
    wsConnected,
    selectedAction,
    httpBaseUrl,
    UI_GAME_PHASES,
    setGameState,
    setPlayerName,
    setPlayers,
    setSelectedRoles,
    setCurrentPhase,
    setSelectedAction,
    setHasSubmitted,
    setCurrentRoom,
    setWsConnected,
    setCurrentRound,
    setRoundEvent,
    setPrivateMessages,
    setPlayerActions,
    setGameResult,
    setWaitingForPlayers,
    setGameBackground,
    setRoleDefinitions,
    setRoomList,
    setLoadingRoomList,
    resetGameState,
    handleRoomAction,
    connectWebSocket,
  } = params;

  /**
   * 处理首页点击事件
   * 从初始页面进入欢迎页面
   */
  const handleInitialPageClick = useCallback((): void => {
    setGameState(GAME_UX_PAGEING.USERNAME);
  }, [setGameState]);

  /**
   * 处理玩家名称设置
   * @param name - 玩家输入的名称
   */
  const handlePlayerNameSet = useCallback(
    (name: string): void => {
      setPlayerName(name);
      setGameState(GAME_UX_PAGEING.ROOM_SELECTION);
    },
    [setPlayerName, setGameState]
  );

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
        await handleRoomAction(action, roomId);
        console.log(`🏠 步骤1: API调用成功，房间加入完成`);

        // 步骤2: API成功后建立WebSocket实时连接
        console.log(`🏠 步骤2: 开始建立WebSocket连接`);
        console.log(
          `🏠 步骤2: 连接参数 - 玩家: ${playerName}, 房间: ${roomId}`
        );
        connectWebSocket(playerName, roomId);
        console.log(`🏠 步骤2: WebSocket连接建立请求已发送`);

        console.log(`🏠 完成: 房间操作流程完成，等待WebSocket连接确认`);
      } catch (error) {
        // 异常处理: 错误已在handleRoomAction中处理并显示，这里记录日志
        console.log(`🏠 异常处理: 房间操作失败`, error);
        console.error("🏠 详细错误信息:", error);
        // 不重新抛出错误，因为用户已经收到错误提示
      }
    },
    [handleRoomAction, connectWebSocket, playerName]
  );

  /**
   * 处理创业想法提交
   * @param idea - 玩家提交的创业想法
   */
  const handleStartupIdeaSubmit = useCallback(
    (idea: string): void => {
      if (wsRef.current && wsConnected) {
        wsRef.current.send(
          JSON.stringify({
            type: "startup_idea",
            data: { idea },
          })
        );
      }
    },
    [wsRef, wsConnected]
  );

  /**
   * 处理角色选择
   * @param roleId - 选择的角色ID
   */
  const handleRoleSelect = useCallback(
    (roleId: string): void => {
      console.log(`🎭 步骤开始: 处理角色选择，角色ID: ${roleId}`);
      console.log(`🎭 步骤开始: WebSocket连接状态: ${wsConnected}`);

      // 步骤1: 立即更新本地玩家状态，提供即时UI反馈
      console.log(`🎭 步骤1: 开始更新本地玩家状态`);
      console.log(`🎭 步骤1: 当前玩家: ${playerName}, 选择角色: ${roleId}`);
      setPlayers((prevPlayers: Player[]) => {
        const updatedPlayers = prevPlayers.map((player: Player) =>
          player.name === playerName ? { ...player, role: roleId } : player
        );
        console.log(`🎭 步骤1: 玩家状态更新完成`, updatedPlayers);
        return updatedPlayers;
      });

      // 步骤2: 更新全局已选择的角色列表
      console.log(`🎭 步骤2: 开始更新已选择角色列表`);
      setSelectedRoles((prevRoles: string[]) => {
        const newRoles = [...prevRoles, roleId];
        console.log(`🎭 步骤2: 已选择角色列表更新:`, {
          previous: prevRoles,
          new: newRoles,
          added: roleId,
        });
        return newRoles;
      });

      // 步骤3: 检查WebSocket连接状态并发送选择消息到服务器
      if (wsRef.current && wsConnected) {
        console.log(`🎭 步骤3: WebSocket连接正常，准备发送角色选择消息`);

        // 步骤3.1: 构造消息对象
        const message = {
          type: "select_role",
          data: { role: roleId },
        };
        console.log(`🎭 步骤3.1: 构造消息对象:`, message);

        // 步骤3.2: 发送消息到服务器
        console.log(`🎭 步骤3.2: 发送角色选择消息到服务器`);
        wsRef.current.send(JSON.stringify(message));
        console.log(`🎭 步骤3.2: 消息发送完成`);

        console.log(`🎭 完成: 角色选择流程完成，等待服务器确认`);
      } else {
        // 步骤3.alt: WebSocket未连接的错误处理
        console.error(`🎭 步骤3.alt: WebSocket未连接，无法发送角色选择消息`);
        console.error(
          `🎭 步骤3.alt: 连接状态 - wsRef存在: ${!!wsRef.current}, 已连接: ${wsConnected}`
        );
        // 注意: 本地状态已更新，如果连接恢复，可以通过状态同步机制处理
      }
    },
    [wsRef, wsConnected, playerName, setPlayers, setSelectedRoles]
  );

  /**
   * 处理游戏行动提交
   * @param action - 玩家的行动数据
   */
  const handleActionSubmit = useCallback(
    (action: PlayerAction): void => {
      if (wsRef.current && wsConnected) {
        wsRef.current.send(
          JSON.stringify({
            type: "game_action",
            data: action,
          })
        );
      }
    },
    [wsRef, wsConnected]
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
    if (wsRef.current && wsConnected) {
      wsRef.current.send(JSON.stringify({ type: "restart_game" }));
    } else {
      resetGameState();
    }
  }, [wsRef, wsConnected, resetGameState]);

  /**
   * 处理退出房间
   * 发送退出消息给后端，关闭WebSocket连接，清除保存状态，返回房间选择页面
   */
  const handleExitRoom = useCallback(async (): Promise<void> => {
    // 如果有WebSocket连接，先发送退出房间消息
    try {
      const response = await fetch(`${httpBaseUrl}/rooms/exit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          player_name: playerName,
        }),
      });

      if (response.ok) {
        console.log("退出房间成功");
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      } else {
        console.error("退出房间失败");
      }
    } catch (error) {
      console.warn("发送退出房间消息失败:", error);
      // 即使发送失败也要关闭连接
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }

    // 重置相关状态
    setWsConnected(false);
    setCurrentRoom("");

    // 重置游戏状态（但不包括gameState，因为我们要手动设置）
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

    // 切换到房间选择页面
    setGameState(GAME_UX_PAGEING.ROOM_SELECTION);
  }, [
    wsRef,
    wsConnected,
    playerName,
    currentRoom,
    setWsConnected,
    setCurrentRoom,
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
    setRoomList,
    setLoadingRoomList,
  ]);

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
      playerName,
      actionType: "decision",
      action: selectedAction,
      round: currentRound,
      timestamp: new Date().toISOString(),
    };
    handleActionSubmit(action);
    setHasSubmitted(true);
  }, [
    selectedAction,
    playerName,
    currentRound,
    handleActionSubmit,
    setHasSubmitted,
  ]);

  return {
    // 基础事件处理
    handleInitialPageClick,
    handlePlayerNameSet,
    handleRoomActionWithConnection,
    handleStartupIdeaSubmit,
    handleRoleSelect,
    handleActionSubmit,
    handleStartRound,
    handleLoadingComplete,
    handleRestartGame,
    handleExitRoom,

    // 前端阶段控制
    goToSelection,
    goToInfoAndOptions,
    goToDiscussion,
    selectAction,
    submitSelectedAction,
  };
}
