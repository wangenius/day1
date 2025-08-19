import { ReactNode, useEffect } from "react";
import { GameContext } from "./GameContext";
import { useGameState } from "./hooks/useGameState";
import { useRoom } from "./hooks/useRoom";
import { useWebSocket } from "./hooks/useWebSocket";
import { useAudioManager } from "./utils/audioManager";

/**
 * 游戏提供者组件属性
 */
interface GameProviderProps {
  /** 子组件 */
  children: ReactNode;
}

/**
 * 游戏上下文提供者组件
 * 管理整个游戏的状态和逻辑，为所有子组件提供游戏相关的数据和方法
 */
export function GameProvider({ children }: GameProviderProps) {
  // 背景音乐管理:
  useAudioManager();

  // WebSocket 管理:
  const webSocket = useWebSocket();

  // API 管理
  const room = useRoom({
    connectWebSocket: webSocket.connect,
  });

  // 游戏状态管理:
  const gameState = useGameState({
    room,
    webSocket,
  });

  useEffect(() => {
    console.log("gameState", gameState);
  }, [gameState]);

  // ==================== Context值对象 ====================

  /**
   * 提供给子组件的Context值
   * 包含所有游戏状态和处理方法
   */
  const value = {
    room,
    gameState,
    webSocket,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
