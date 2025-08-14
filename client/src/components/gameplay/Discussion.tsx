interface DiscussionProps {
  onGoToSelection: () => void;
}

/**
 * 3. 讨论环节组件
 */
export const Discussion = ({ onGoToSelection }: DiscussionProps) => {
  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden flex flex-col p-4">
      {/* 标题区域 */}
      <div className="text-center pt-8 pb-6">
        <div className="opacity-60 text-white text-xl font-normal font-['Cactus_Classical_Serif'] uppercase leading-normal">
          开会时间
          <br />
          请轮流发表意见
        </div>
      </div>

      {/* 中间讨论图片区域 */}
      <div className="flex-1 flex items-center justify-center px-4">
        <img
          className="w-full max-w-sm h-auto"
          src="./askAI.png"
          alt="讨论场景"
        />
      </div>

      {/* 底部按钮和倒计时 */}
      <div className="flex flex-col items-center pb-8 space-y-4">
        <button
          onClick={onGoToSelection}
          className="px-8 py-3 bg-gradient-to-b from-zinc-700 to-zinc-800 text-white rounded-lg font-medium hover:from-zinc-600 hover:to-zinc-700 transition-all duration-200"
        >
          进入选择阶段
        </button>
      </div>
    </div>
  );
};
