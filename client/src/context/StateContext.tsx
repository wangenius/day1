// 重构后的 GameContext，导出新的模块化组件
export { StateProvider as GameProvider } from "./StateProvider";
import { createContext, useContext } from "react";
import { UseGameReturn } from "./hooks/useGame";
import { UseRoomReturn } from "./hooks/useRoom";
import { UseWebSocketReturn } from "./hooks/useWebSocket";

/**
 * 游戏上下文类型定义
 */
export interface GameContextType {
  room: UseRoomReturn;
  game: UseGameReturn;
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
export function useGameState(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame 必须在 GameProvider 内使用");
  }
  return ctx;
}
