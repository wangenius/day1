import { ReactNode } from "react";
import { GameContext } from "./StateContext";
import { useGame } from "./hooks/useGame";
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
export function StateProvider({ children }: GameProviderProps) {
  // 背景音乐管理:
  useAudioManager();

  // WebSocket 管理:
  const webSocket = useWebSocket();

  // API 管理
  const room = useRoom({ webSocket });

  // 游戏状态管理:
  const game = useGame({ room, webSocket });

  /**
   * 提供给子组件的Context值
   * 包含所有游戏状态和处理方法
   */
  const value = {
    room,
    game,
    webSocket,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
