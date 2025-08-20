import { useState } from "react";
import { useGameState } from "../../context/StateContext";
import { EventDisplay } from "./EventDisplay";
import { EventModal } from "./EventModal";
import { InfoAndOptions } from "./InfoAndOptions";
import { PrivateModal } from "./PrivateModal";
import { Selection } from "./Selection";

/**
 * 角色图片映射类型
 */
interface RoleImageMap {
  [key: string]: string;
}

/**
 * 游戏玩法组件
 * 管理游戏的不同阶段和玩家交互
 */
function GamePlay() {
  const { room, game } = useGameState();

  const [showEventModal, setShowEventModal] = useState(false);
  const [showPrivateModal, setShowPrivateModal] = useState(false);

  // 移除本地状态，统一由 Context 管理

  /**
   * 根据角色名称确定对应的图片
   * @param role - 角色名称
   * @returns 图片路径
   */
  const getRoleImage = (role: string): string => {
    const roleImageMap: RoleImageMap = {
      CEO: "/image (2).png",
      CTO: "/image (3).png",
      CMO: "/image (4).png",
      COO: "/image (1).png",
      CPO: "/image (5).png",
    };
    return roleImageMap[role.toUpperCase()] || "/image (2).png"; // 默认使用CEO图片
  };

  console.log(game.state.rounds[game.state.current_round]);

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
        playerRole={game.state.roles[room.player]}
        privateMessages={
          game.state.rounds[game.state.current_round].private_messages
        }
        getRoleImage={getRoleImage}
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
