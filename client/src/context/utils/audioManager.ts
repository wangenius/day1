import { useEffect, useRef, useState } from "react";

/**
 * 背景音乐管理 Hook
 */
export function useAudioManager() {
  /** 背景音乐引用 */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** 音频是否已初始化 */
  const [isAudioReady, setIsAudioReady] = useState(false);

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

    // 监听音频加载完成事件
    const handleCanPlay = () => {
      setIsAudioReady(true);
    };

    // 监听音频播放错误
    const handleError = (error: Event) => {
      console.error("音频播放失败:", error);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    // 尝试播放音频（可能被浏览器阻止）
    const playAudio = async () => {
      try {
        await audio.play();
      } catch (error) {
        console.log("自动播放被阻止，等待用户交互后播放");
        // 音频播放被阻止，等待用户交互
      }
    };

    playAudio();

    // 清理函数：组件卸载时停止音频播放
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('canplay', handleCanPlay);
        audioRef.current.removeEventListener('error', handleError);
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  /**
   * 开始播放音频（需要用户交互）
   */
  const startAudio = async () => {
    if (audioRef.current && isAudioReady) {
      try {
        await audioRef.current.play();
      } catch (error) {
        console.error("播放音频失败:", error);
      }
    }
  };

  /**
   * 暂停音频
   */
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  /**
   * 设置音量
   */
  const setVolume = (volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  };

  return {
    audioRef,
    isAudioReady,
    startAudio,
    pauseAudio,
    setVolume
  };
}
