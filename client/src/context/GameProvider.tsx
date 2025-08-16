import { ReactNode, useEffect } from "react";
import { GAME_UX_PAGEING } from "../const/const";
import { GameContext } from "./GameContext";
import { useGameAPI } from "./hooks/useGameAPI";
import { useGameHandlers } from "./hooks/useGameHandlers";
import { useGameState } from "./hooks/useGameState";
import { useWebSocket } from "./hooks/useWebSocket";
import { useAudioManager } from "./utils/audioManager";
import { getServerConfig } from "./utils/serverConfig";

/**
 * 游戏提供者组件属性
 */
interface GameProviderProps {
  /** 子组件 */
  children: ReactNode;
}

// 解构获取服务器配置
const { http: API_BASE, ws: WS_BASE } = getServerConfig();

// UI游戏阶段常量
const UI_GAME_PHASES = {
  EVENT_DISPLAY: "event_display",
  INFO_AND_OPTIONS: "info_and_options",
  DISCUSSION: "discussion",
  SELECTION: "selection",
} as const;

/**
 * 游戏上下文提供者组件
 * 管理整个游戏的状态和逻辑，为所有子组件提供游戏相关的数据和方法
 */
export function GameProvider({ children }: GameProviderProps) {
  // ==================== 初始化各个模块 ====================

  // 背景音乐管理:
  useAudioManager();

  // 游戏状态管理:
  const gameState = useGameState();

  useEffect(() => {
    console.log("gameState", gameState);
  }, [gameState]);

  // WebSocket 管理:
  const webSocket = useWebSocket({
    wsBaseUrl: WS_BASE,
    httpBaseUrl: API_BASE,
    playerName: gameState.playerName,
    currentRound: gameState.currentRound,
    currentPhase: gameState.currentPhase,
    UI_GAME_PHASES,
    setWsConnected: gameState.setWsConnected,
    setCurrentRoom: gameState.setCurrentRoom,
    setGameState: gameState.setGameState,
    setCurrentRound: gameState.setCurrentRound,
    setCurrentPhase: gameState.setCurrentPhase,
    setTimeLeft: gameState.setTimeLeft,
    setSelectedAction: gameState.setSelectedAction,
    setHasSubmitted: gameState.setHasSubmitted,
    setPlayers: gameState.setPlayers,
    setSelectedRoles: gameState.setSelectedRoles,
    setRoundEvent: gameState.setRoundEvent,
    setPrivateMessages: gameState.setPrivateMessages,
    setPlayerActions: gameState.setPlayerActions,
    setWaitingForPlayers: gameState.setWaitingForPlayers,
    setGameResult: gameState.setGameResult,
    setGameBackground: gameState.setGameBackground,
    setRoleDefinitions: gameState.setRoleDefinitions,
    resetGameState: gameState.resetGameState,
  });

  // API 管理
  const gameAPI = useGameAPI({
    httpBaseUrl: API_BASE,
    playerName: gameState.playerName,
    setRoomList: gameState.setRoomList,
    setLoadingRoomList: gameState.setLoadingRoomList,
  });

  // 事件处理器
  const gameHandlers = useGameHandlers({
    playerName: gameState.playerName,
    currentRoom: gameState.currentRoom,
    currentRound: gameState.currentRound,
    wsRef: webSocket.wsRef,
    wsConnected: gameState.wsConnected,
    selectedAction: gameState.selectedAction,
    httpBaseUrl: API_BASE,
    UI_GAME_PHASES,
    setGameState: gameState.setGameState,
    setPlayerName: gameState.setPlayerName,
    setPlayers: gameState.setPlayers,
    setSelectedRoles: gameState.setSelectedRoles,
    setCurrentPhase: gameState.setCurrentPhase,
    setSelectedAction: gameState.setSelectedAction,
    setHasSubmitted: gameState.setHasSubmitted,
    setCurrentRoom: gameState.setCurrentRoom,
    setWsConnected: gameState.setWsConnected,
    setCurrentRound: gameState.setCurrentRound,
    setRoundEvent: gameState.setRoundEvent,
    setPrivateMessages: gameState.setPrivateMessages,
    setPlayerActions: gameState.setPlayerActions,
    setGameResult: gameState.setGameResult,
    setWaitingForPlayers: gameState.setWaitingForPlayers,
    setGameBackground: gameState.setGameBackground,
    setRoleDefinitions: gameState.setRoleDefinitions,
    setRoomList: gameState.setRoomList,
    setLoadingRoomList: gameState.setLoadingRoomList,
    resetGameState: gameState.resetGameState,
    handleRoomAction: gameAPI.handleRoomAction,
    connectWebSocket: webSocket.connectWebSocket,
  });

  // ==================== Effect钩子 ====================

  /**
   * 从localStorage 加载玩家名称, 并请求重新连接
   */
  useEffect(() => {
    const savedPlayerName = localStorage.getItem("startup_player_name");
    if (savedPlayerName) {
      gameState.setPlayerName(savedPlayerName);
      webSocket.reconnectToRoom(savedPlayerName);
    }
  }, []);

  /**
   * 保存玩家名称到本地存储
   * 当玩家名称发生变化时自动保存
   */
  useEffect(() => {
    if (gameState.playerName) {
      localStorage.setItem("startup_player_name", gameState.playerName);
    }
  }, [gameState.playerName]);

  // ==================== Context值对象 ====================

  /**
   * 提供给子组件的Context值
   * 包含所有游戏状态和处理方法
   */
  const value = {
    // ========== 常量 ==========
    GAME_STATES: GAME_UX_PAGEING,
    // ========== 状态数据 ==========
    gameState: gameState.gameState,
    playerName: gameState.playerName,
    currentRoom: gameState.currentRoom,
    players: gameState.players,
    wsConnected: gameState.wsConnected,
    currentRound: gameState.currentRound,
    roundEvent: gameState.roundEvent,
    privateMessages: gameState.privateMessages,
    playerActions: gameState.playerActions,
    gameResult: gameState.gameResult,
    selectedRoles: gameState.selectedRoles,
    waitingForPlayers: gameState.waitingForPlayers,
    gameBackground: gameState.gameBackground,
    roleDefinitions: gameState.roleDefinitions,
    roomList: gameState.roomList,
    loadingRoomList: gameState.loadingRoomList,

    // ========== 前端阶段与交互状态 ==========
    currentPhase: gameState.currentPhase,
    timeLeft: gameState.timeLeft,
    selectedAction: gameState.selectedAction,
    hasSubmitted: gameState.hasSubmitted,
    showPrivateModal: gameState.showPrivateModal,
    showEventModal: gameState.showEventModal,

    goToSelection: gameHandlers.goToSelection,
    goToInfoAndOptions: gameHandlers.goToInfoAndOptions,
    goToDiscussion: gameHandlers.goToDiscussion,
    selectAction: gameHandlers.selectAction,
    submitSelectedAction: gameHandlers.submitSelectedAction,
    setShowPrivateModal: gameState.setShowPrivateModal,
    setShowEventModal: gameState.setShowEventModal,

    // ========== 事件处理方法 ==========
    handleInitialPageClick: gameHandlers.handleInitialPageClick,
    handlePlayerNameSet: gameHandlers.handlePlayerNameSet,
    handleRoomAction: gameHandlers.handleRoomActionWithConnection,
    handleStartupIdeaSubmit: gameHandlers.handleStartupIdeaSubmit,
    handleRoleSelect: gameHandlers.handleRoleSelect,
    handleActionSubmit: gameHandlers.handleActionSubmit,
    handleStartRound: gameHandlers.handleStartRound,
    handleLoadingComplete: gameHandlers.handleLoadingComplete,
    handleRestartGame: gameHandlers.handleRestartGame,
    handleExitRoom: gameHandlers.handleExitRoom,
    fetchRoomList: gameAPI.fetchRoomList,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
