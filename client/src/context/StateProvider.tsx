import { ReactNode, useEffect } from "react";
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
  const audioManager = useAudioManager();

  // 监听用户交互事件来启动音频
  useEffect(() => {
    const handleUserInteraction = () => {
      if (audioManager.isAudioReady) {
        audioManager.startAudio();
        // 移除事件监听器，避免重复触发
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      }
    };

    // 添加用户交互事件监听器
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    // 清理函数
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [audioManager.isAudioReady, audioManager.startAudio]);

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
    audioManager,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
