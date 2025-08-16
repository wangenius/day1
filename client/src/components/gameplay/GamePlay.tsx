import { useEffect } from "react";
import { useGame } from "../../context/GameContext";
import { InfoAndOptions } from "./InfoAndOptions";
import { EventDisplay } from "./EventDisplay";
import { PrivateModal } from "./PrivateModal";
import { EventModal } from "./EventModal";
import { Selection } from "./Selection";

/**
 * 游戏阶段枚举
 */
const GAME_PHASES = {
  EVENT_DISPLAY: "event_display", // 1. 展示事件
  INFO_AND_OPTIONS: "info_and_options", // 2. 展示信息和选项
  DISCUSSION: "discussion", // 3. 讨论环节
  SELECTION: "selection", // 4. 选择确认
} as const;

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
  const {
    players,
    playerName,
    currentRound,
    roundEvent,
    privateMessages,
    playerActions,
    gameBackground,
    waitingForPlayers,
    // UI/交互来自 Context
    currentPhase,
    selectedAction,
    hasSubmitted,
    timeLeft,
    showPrivateModal,
    showEventModal,
    setShowPrivateModal,
    setShowEventModal,
    goToSelection,
    selectAction,
    submitSelectedAction,
  } = useGame();

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

  console.log(roundEvent);

  useEffect(() => {
    // 阶段切换与倒计时均在 Context 统一管理
  }, []);

  /**
   * 手动切换到选择阶段
   */
  // goToSelection 已由 Context 提供

  /**
   * 处理提交行动
   */
  const handleSubmitAction = (): void => {
    submitSelectedAction();
  };

  const currentPlayer = players?.find((p) => p.name === playerName);
  const playerRole = currentPlayer?.role || "";

  /**
   * 渲染不同阶段的组件
   * @returns JSX元素
   */
  const renderPhaseContent = () => {
    switch (currentPhase) {
      case GAME_PHASES.EVENT_DISPLAY:
        return (
          <EventDisplay
            playerName={playerName}
            playerRole={playerRole}
            currentRound={currentRound}
            roundEvent={roundEvent}
            getRoleImage={getRoleImage}
            onShowEventModal={() => setShowEventModal(true)}
          />
        );
      case GAME_PHASES.INFO_AND_OPTIONS:
        return (
          <InfoAndOptions
            playerName={playerName}
            playerRole={playerRole}
            currentRound={currentRound}
            roundEvent={roundEvent}
            privateMessages={privateMessages}
            getRoleImage={getRoleImage}
            onShowEventModal={() => setShowEventModal(true)}
            onShowPrivateModal={() => setShowPrivateModal(true)}
            onGoToSelection={goToSelection}
          />
        );
      case GAME_PHASES.DISCUSSION:
        return (
          <InfoAndOptions
            playerName={playerName}
            playerRole={playerRole}
            currentRound={currentRound}
            roundEvent={roundEvent}
            privateMessages={privateMessages}
            getRoleImage={getRoleImage}
            onShowEventModal={() => setShowEventModal(true)}
            onShowPrivateModal={() => setShowPrivateModal(true)}
            onGoToSelection={goToSelection}
          />
        );
      case GAME_PHASES.SELECTION:
        return (
          <Selection
            playerName={playerName}
            playerRole={playerRole}
            currentRound={currentRound}
            roundEvent={roundEvent}
            privateMessages={privateMessages}
            selectedAction={selectedAction}
            hasSubmitted={hasSubmitted}
            waitingForPlayers={waitingForPlayers}
            players={players}
            playerActions={playerActions}
            getRoleImage={getRoleImage}
            onShowEventModal={() => setShowEventModal(true)}
            onShowPrivateModal={() => setShowPrivateModal(true)}
            onSelectAction={selectAction}
            onSubmitAction={handleSubmitAction}
          />
        );
      default:
        return (
          <EventDisplay
            playerName={playerName}
            playerRole={playerRole}
            currentRound={currentRound}
            roundEvent={roundEvent}
            getRoleImage={getRoleImage}
            onShowEventModal={() => setShowEventModal(true)}
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
          第{currentRound}阶段（点击查看剧情）
        </div>

        {/* 倒计时 */}
        <div className="text-white text-xs font-normal font-['Space_Grotesk']">
          {timeLeft + "s"}
        </div>
      </div>
      {renderPhaseContent()}
      <PrivateModal
        isOpen={showPrivateModal}
        playerName={playerName}
        playerRole={playerRole}
        privateMessages={privateMessages}
        getRoleImage={getRoleImage}
        onClose={() => setShowPrivateModal(false)}
      />
      <EventModal
        isOpen={showEventModal}
        currentRound={currentRound}
        roundEvent={roundEvent}
        gameBackground={gameBackground}
        onClose={() => setShowEventModal(false)}
      />
    </div>
  );
}

export default GamePlay;
