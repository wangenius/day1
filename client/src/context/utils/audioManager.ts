import { useEffect, useRef } from "react";

/**
 * 背景音乐管理 Hook
 */
export function useAudioManager() {
  /** 背景音乐引用 */
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * 初始化背景音乐
   * 设置音频循环播放，处理自动播放策略限制
   */
  useEffect(() => {
    // 创建音频对象
    const audio = new Audio("/背景音效.mp3");
    audio.loop = true; // 循环播放
    audio.volume = 0.3; // 设置音量为30%
    audioRef.current = audio;

    audio.play();

    // 清理函数：组件卸载时停止音频播放
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return audioRef;
}
