import { useGameState } from "@/context/StateContext";

interface PrivateModalProps {
  isOpen: boolean;
  playerName: string;
  onClose: () => void;
}

/**
 * 私人信息模态框组件
 */
export const PrivateModal = ({
  isOpen,
  playerName,
  onClose,
}: PrivateModalProps) => {
  const { game } = useGameState();
  const playerRole = game.state.roles[playerName];
  const privateMessage =
    game.state.rounds[game.state.current_round].private_messages[
      String(playerRole).toUpperCase()
    ];
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="w-96 h-[874px] bg-stone-950 overflow-hidden relative">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900/20 to-stone-950"></div>

        {/* 关闭按钮 */}
        <button
          className="absolute top-6 right-6 w-10 h-10 bg-stone-800/80 rounded-full border border-stone-600 flex items-center justify-center text-white hover:text-amber-300 hover:border-amber-500 transition-all duration-200 z-10"
          onClick={onClose}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* 顶部玩家信息区域 */}
        <div className="flex justify-center pt-8 pb-4">
          <div className="relative">
            <div className="w-20 h-20 absolute left-[55px] top-[36px] bg-amber-400/20 blur-[50px]"></div>
            <img
              className="w-40 h-40"
              src={`/image_${playerRole.toLowerCase()}.png`}
              alt="Player Avatar"
            />
            <div className="absolute bottom-0 right-0 text-right text-white text-sm font-normal font-['Space_Grotesk'] bg-black/50 px-3 py-2 rounded-lg backdrop-blur-sm border border-amber-500/30">
              <div className="text-amber-300 font-semibold">{playerName}</div>
              <div className="text-xs opacity-80">{playerRole}</div>
            </div>
          </div>
        </div>

        {/* 标题区域 */}
        <div className="text-center mb-8">
          <div className="inline-block px-6 py-3 bg-amber-600/20 rounded-full border border-amber-500/40 backdrop-blur-sm">
            <span className="text-amber-300 text-xl font-normal font-['Cactus_Classical_Serif'] uppercase tracking-wider">
              机密信息
            </span>
          </div>
          <div className="text-stone-400 text-sm mt-2 font-['Cactus_Classical_Serif']">
            只有 {playerRole} 可以查看
          </div>
        </div>

        {/* 私人信息内容区域 */}
        <div className="px-8 pb-8">
          <div className="bg-gradient-to-b from-stone-800/60 to-stone-900/80 rounded-xl p-6 border border-stone-700/50 backdrop-blur-sm relative overflow-hidden">
            {/* 装饰性背景图案 */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
              <img
                src="./print.png"
                alt=""
                className="w-full h-full object-contain"
              />
            </div>

            {/* 内容 */}
            <div className="relative z-10">
              <div className="text-white text-lg font-normal font-['Cactus_Classical_Serif'] leading-relaxed text-center mb-6">
                {privateMessage}
              </div>

              {/* 底部装饰线 */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <div className="w-8 h-px bg-gradient-to-r from-transparent to-amber-500/50"></div>
                <div className="flex items-center gap-2 text-amber-400">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-['Cactus_Classical_Serif'] uppercase tracking-widest">
                    机密
                  </span>
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                </div>
                <div className="w-8 h-px bg-gradient-to-l from-transparent to-amber-500/50"></div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部提示 */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <div className="text-stone-500 text-sm font-['Cactus_Classical_Serif']">
            点击右上角关闭按钮返回游戏
          </div>
        </div>

        {/* 边框装饰 */}
        <div className="absolute inset-0 border border-amber-500/20 rounded-lg pointer-events-none"></div>
      </div>
    </div>
  );
};
