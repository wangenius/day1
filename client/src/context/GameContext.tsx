// 重构后的 GameContext，导出新的模块化组件
export { GameProvider } from "./GameProvider";
import { createContext, useContext } from "react";
import { UseGameStateReturn } from "./hooks/useGameState";
import { UseRoomReturn } from "./hooks/useRoom";
import { UseWebSocketReturn } from "./hooks/useWebSocket";

/**
 * 游戏上下文类型定义
 */
export interface GameContextType {
  room: UseRoomReturn;
  gameState: UseGameStateReturn;
  webSocket: UseWebSocketReturn;
}

/**
 * 创建游戏上下文
 */
export const GameContext = createContext<GameContextType | null>(null);

/**
 * 使用游戏上下文的Hook
 * @returns 游戏上下文对象
 * @throws 如果在GameProvider外使用则抛出错误
 */
export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame 必须在 GameProvider 内使用");
  }
  return ctx;
}
