import { PlayerInfo } from "./PlayerInfo";
import { PrivateInfo } from "./PrivateInfo";

interface InfoAndOptionsProps {
  playerName: string;
  playerRole: string;
  currentRound: number;
  roundEvent: any;
  privateMessages: Record<string, string>;
  getRoleImage: (role: string) => string;
  onShowEventModal: () => void;
  onShowPrivateModal: () => void;
  onGoToSelection: () => void;
}

/**
 * 2. 展示信息和选项阶段组件
 */
export const InfoAndOptions = ({
  playerName,
  playerRole,
  currentRound,
  roundEvent,
  privateMessages,
  getRoleImage,
  onShowEventModal,
  onShowPrivateModal,
  onGoToSelection,
}: InfoAndOptionsProps) => {
  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden flex flex-col p-4">
      {/* 顶部玩家信息和阶段标题 */}
      <div className="flex flex-col items-center pt-4 pb-6">
        <div className="mb-4">
          <PlayerInfo
            playerName={playerName}
            playerRole={playerRole}
            getRoleImage={getRoleImage}
            size="medium"
          />
        </div>

        <div
          className="opacity-60 text-white text-lg font-normal font-['Cactus_Classical_Serif'] uppercase cursor-pointer hover:opacity-80 transition-opacity duration-200"
          onClick={onShowEventModal}
        >
          第{currentRound}阶段
        </div>
      </div>

      {/* 私人信息 */}
      <PrivateInfo
        privateMessages={privateMessages}
        playerRole={playerRole}
        onShowPrivateModal={onShowPrivateModal}
      />

      {/* 提示文字 */}
      <div className="text-center mb-6">
        <div className="opacity-60 text-white text-lg font-normal font-['Cactus_Classical_Serif'] uppercase">
          请在和团队讨论后做出选择
        </div>
      </div>

      {/* 选项展示 */}
      <div className="flex-1 px-4">
        <div className="max-w-sm mx-auto space-y-4">
          {roundEvent?.decision_options ? (
            Object.entries(roundEvent.decision_options).map(([key, action]) => (
              <div
                key={key}
                className="w-full h-16 px-6 py-3 bg-neutral-700 rounded-lg flex items-center justify-center"
              >
                <div className="text-white text-lg font-normal font-['Cactus_Classical_Serif'] text-center">
                  {key}. {String(action)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-white text-center">选项加载中...</div>
          )}
        </div>
      </div>

      {/* 进入讨论按钮 */}
      <div className="flex flex-col items-center pb-8">
        <div
          className="cursor-pointer flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={onGoToSelection}
        >
          <div className="text-white/70 text-base font-normal font-['Cactus_Classical_Serif']">
            进入讨论
          </div>
        </div>
      </div>
    </div>
  );
};
