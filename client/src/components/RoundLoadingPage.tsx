import { useGameState } from "../context/StateContext";

/**
 * 轮次加载页面组件
 * 显示轮次加载状态和进度
 */
function RoundLoadingPage() {
  const { game } = useGameState();

  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden flex flex-col items-center justify-center p-4">
      <video
        className="w-24 h-24"
        src="/videoExport-2025-07-26@12-08-48.606-540x540@60fps.mp4"
        autoPlay
        loop
        controls={false}
      />
      <p className="text-white text-lg mt-4">公司发展中...</p>
      <p className="text-white text-lg mt-4">第{game.state.current_round}轮</p>
      <small className="text-white text-sm mt-4">一共5轮</small>
    </div>
  );
}

export default RoundLoadingPage;
