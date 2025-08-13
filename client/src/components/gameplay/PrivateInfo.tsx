interface PrivateInfoProps {
  privateMessages: Record<string, string>;
  playerRole: string;
  onShowPrivateModal: () => void;
}

/**
 * 私人信息纸条组件
 */
export const PrivateInfo = ({
  privateMessages,
  playerRole,
  onShowPrivateModal,
}: PrivateInfoProps) => {
  if (!privateMessages || !privateMessages[String(playerRole).toUpperCase()]) {
    return null;
  }

  return (
    <div className="px-4 mb-6">
      <div className="px-4 mb-6 relative">
        <div
          className="relative cursor-pointer hover:scale-105 transition-transform duration-200 max-w-sm mx-auto"
          onClick={onShowPrivateModal}
        >
          <img className="w-full h-52" src="./paper.png" alt="私人信息" />
          <div className="absolute inset-0 flex flex-col justify-center items-start px-6 py-4">
            {/* 顶部提示文字 */}
            <div className="opacity-60 text-neutral-600 text-xs font-normal font-['Cactus_Classical_Serif'] uppercase leading-none mb-2 text-start">
              仅你可见，点击可以展开
            </div>

            {/* 主要内容区域 */}
            <div className="flex-1 flex items-center justify-center w-full">
              <div className="text-center text-zinc-800 text-md font-normal font-['Cactus_Classical_Serif'] [text-shadow:_1px_1px_2px_rgb(142_142_142_/_0.25)] leading-relaxed max-w-full overflow-hidden">
                <div className="line-clamp-4 px-1">
                  {privateMessages[String(playerRole).toUpperCase()]}
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 right-4">
              <img
                className="w-8 h-8"
                src="/src/assets/秘.png"
                alt="秘密标记"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
