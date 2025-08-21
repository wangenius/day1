import { useGameState } from "@/context/StateContext";
import { PlayerInfo } from "./PlayerInfo";

/**
 * 1. 展示事件阶段组件
 */
export const EventDisplay = ({
  onShowEventModal,
}: {
  onShowEventModal: () => void;
  onShowPrivateModal: () => void;
}) => {
  const { game, room } = useGameState();

  const getRoleImage = (role: string): string => {
    return `/image (${role.toUpperCase()}).png`;
  };

  return (
    <div className="flex-1 w-full bg-stone-950 overflow-hidden flex flex-col p-4">
      {/* 顶部玩家信息区域 */}
      <div className="flex justify-center pt-4 pb-6">
        <PlayerInfo
          playerName={room.player}
          playerRole={game.state.roles[room.player]}
          getRoleImage={getRoleImage}
        />
      </div>

      {/* 事件信息区域 */}
      <div className="flex-1 px-4 py-6">
        <div className="bg-gradient-to-b from-stone-800/50 to-stone-900/50 rounded-xl p-6 border border-stone-700/50 backdrop-blur-sm max-w-sm mx-auto">
          <div className="text-center mb-6">
            <div
              className="inline-block px-6 py-3 bg-amber-600/20 rounded-full border border-amber-500/30 cursor-pointer hover:bg-amber-600/30 hover:border-amber-500/50 transition-all duration-200"
              onClick={() => {
                onShowEventModal();
              }}
            >
              <span className="text-amber-300 text-lg font-normal font-['Cactus_Classical_Serif'] uppercase">
                第{game.state.current_round}阶段{" "}
                {typeof game.state.rounds[game.state.current_round]
                  .phase_remain === "number"
                  ? `· ${
                      game.state.rounds[game.state.current_round].phase_remain
                    }s`
                  : ""}
              </span>
            </div>
          </div>

          <div className="text-white text-lg font-normal font-['Cactus_Classical_Serif'] leading-relaxed text-center">
            {game.state.rounds[game.state.current_round].situation || (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>事件加载中...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部装饰 */}
      <div className="h-16 flex items-center justify-center">
        <div className="w-16 h-1 bg-gradient-to-r from-transparent via-stone-600 to-transparent rounded-full"></div>
      </div>
    </div>
  );
};
