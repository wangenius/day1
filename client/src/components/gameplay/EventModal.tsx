import ReactMarkdown from "react-markdown";

interface EventModalProps {
  isOpen: boolean;
  currentRound: number;
  roundEvent: any;
  gameBackground?: string | null;
  onClose: () => void;
}

/**
 * 事件详情模态框组件
 */
export const EventModal = ({
  isOpen,
  currentRound,
  roundEvent,
  gameBackground,
  onClose,
}: EventModalProps) => {
  if (!isOpen || !roundEvent) {
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

        {/* 标题区域 */}
        <div className="text-center pt-16 pb-8">
          <div className="inline-block px-6 py-3 bg-amber-600/20 rounded-full border border-amber-500/40 backdrop-blur-sm">
            <span className="text-amber-300 text-xl font-normal font-['Cactus_Classical_Serif'] uppercase tracking-wider">
              第{currentRound}阶段详情
            </span>
          </div>
          <div className="text-stone-400 text-sm mt-2 font-['Cactus_Classical_Serif']">
            事件详细描述
          </div>
        </div>

        {/* 事件详情内容区域 */}
        <div className="px-8 pb-4">
          <div className="bg-gradient-to-b from-stone-800/60 to-stone-900/80 rounded-xl p-6 border border-stone-700/50 backdrop-blur-sm relative overflow-hidden">
            {/* 装饰性背景图案 */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
              <div className="w-full h-full bg-amber-400/10 rounded-full blur-xl"></div>
            </div>

            {/* 内容 */}
            <div className="relative z-10">
              <div className="text-white text-lg font-normal font-['Cactus_Classical_Serif'] leading-relaxed text-center mb-6">
                {roundEvent.event_description}
              </div>

              {/* 底部装饰线 */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <div className="w-8 h-px bg-gradient-to-r from-transparent to-amber-500/50"></div>
                <div className="flex items-center gap-2 text-amber-400">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-['Cactus_Classical_Serif'] uppercase tracking-widest">
                    事件
                  </span>
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                </div>
                <div className="w-8 h-px bg-gradient-to-l from-transparent to-amber-500/50"></div>
              </div>
            </div>
          </div>
        </div>

        {/* 创业背景信息区域 */}
        {gameBackground && (
          <div className="px-8 pb-8">
            <div className="bg-gradient-to-b from-blue-900/30 to-blue-950/50 rounded-xl p-4 border border-blue-700/30 backdrop-blur-sm max-h-64 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-blue-300 text-lg">📖</span>
                <h3 className="text-blue-300 text-base font-semibold font-['Cactus_Classical_Serif']">
                  创业背景
                </h3>
              </div>

              <div className="text-sm text-gray-300 font-['Cactus_Classical_Serif'] markdown-content">
                {gameBackground.split("\n").map((line, index) => (
                  <div key={index} className="mb-2">{line}</div>
                ))}
              </div>
            </div>
          </div>
        )}

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
