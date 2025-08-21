import { useState } from "react";
import { useGameState } from "../../context/StateContext";
import { EventDisplay } from "./EventDisplay";
import { EventModal } from "./EventModal";
import { InfoAndOptions } from "./InfoAndOptions";
import { PrivateModal } from "./PrivateModal";
import { Selection } from "./Selection";

/**
 * 游戏玩法组件
 * 管理游戏的不同阶段和玩家交互
 */
function GamePlay() {
  const { room, game } = useGameState();
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPrivateModal, setShowPrivateModal] = useState(false);


  /**
   * 渲染不同阶段的组件
   * @returns JSX元素
   */
  const renderPhaseContent = () => {
    if (game.state.rounds[game.state.current_round].phase_remain > 175) {
      return (
        <EventDisplay
          onShowEventModal={() => setShowEventModal(true)}
          onShowPrivateModal={() => setShowPrivateModal(true)}
        />
      );
    }
    if (game.state.rounds[game.state.current_round].phase_remain > 170) {
      return (
        <InfoAndOptions
          onShowEventModal={() => setShowEventModal(true)}
          onShowPrivateModal={() => setShowPrivateModal(true)}
        />
      );
    }

    if (game.state.rounds[game.state.current_round].phase_remain > 0) {
      return (
        <Selection
          onShowEventModal={() => setShowEventModal(true)}
          onShowPrivateModal={() => setShowPrivateModal(true)}
        />
      );
    }
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden flex flex-col">
      {/* 顶部布局：左上角阶段，右上角用户名 */}
      <div className="flex justify-between items-start pt-4 pb-6">
        {/* 左上角：阶段 */}
        <div
          className="opacity-60 text-white text-lg font-normal font-['Cactus_Classical_Serif'] uppercase leading-normal cursor-pointer hover:opacity-80 transition-opacity duration-200"
          onClick={() => setShowEventModal(true)}
        >
          第{game.state.current_round}阶段（点击查看剧情）
        </div>

        {/* 倒计时 */}
        <div className="text-white text-xs font-normal font-['Space_Grotesk']">
          {game.state.rounds[game.state.current_round].phase_remain + "s"}
        </div>
      </div>
      {renderPhaseContent()}
      <PrivateModal
        isOpen={showPrivateModal}
        playerName={room.player}
        onClose={() => setShowPrivateModal(false)}
      />
      <EventModal
        isOpen={showEventModal}
        currentRound={game.state.current_round}
        event={game.state.rounds[game.state.current_round].situation}
        background={game.state.background}
        onClose={() => setShowEventModal(false)}
      />
    </div>
  );
}

export default GamePlay;
