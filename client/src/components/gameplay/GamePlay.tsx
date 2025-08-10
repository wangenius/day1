import { useEffect, useState } from "react";
import type { PlayerAction } from "../../const/const";
import { useGame } from "../../context/GameContextCore";
import { InfoAndOptions } from "./InfoAndOptions";
import { EventDisplay } from "./EventDisplay";
import { Discussion } from "./Discussion";
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
 * 游戏阶段类型
 */
type GamePhase = (typeof GAME_PHASES)[keyof typeof GAME_PHASES];

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
    handleActionSubmit,
  } = useGame();

  const [selectedAction, setSelectedAction] = useState<string>("");
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [currentPhase, setCurrentPhase] = useState<GamePhase>(
    GAME_PHASES.EVENT_DISPLAY
  );
  const [discussionTimeLeft, setDiscussionTimeLeft] = useState<number>(120); // 讨论时间120秒
  const [selectionTimeLeft, setSelectionTimeLeft] = useState<number>(20); // 选择时间20秒
  const [showPrivateModal, setShowPrivateModal] = useState<boolean>(false); // 控制私人信息模态框显示
  const [showEventModal, setShowEventModal] = useState<boolean>(false); // 控制事件详情模态框显示

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
    // 重置提交状态当新一轮开始时
    setHasSubmitted(false);
    setSelectedAction("");
    setCurrentPhase(GAME_PHASES.EVENT_DISPLAY);
    setDiscussionTimeLeft(120);
    setSelectionTimeLeft(20);
  }, [currentRound]);

  // 阶段自动切换逻辑
  useEffect(() => {
    let timer: number;

    if (currentPhase === GAME_PHASES.EVENT_DISPLAY) {
      // 事件展示阶段，10秒后自动切换到信息和选项阶段
      timer = setTimeout(() => {
        setCurrentPhase(GAME_PHASES.INFO_AND_OPTIONS);
      }, 10000);
    } else if (currentPhase === GAME_PHASES.INFO_AND_OPTIONS) {
      // 信息和选项阶段，20秒后自动切换到讨论阶段
      timer = setTimeout(() => {
        setCurrentPhase(GAME_PHASES.DISCUSSION);
      }, 20000);
    }

    return () => clearTimeout(timer);
  }, [currentPhase]);

  // 讨论阶段倒计时
  useEffect(() => {
    let timer: number;

    if (currentPhase === GAME_PHASES.DISCUSSION && discussionTimeLeft > 0) {
      timer = setTimeout(() => {
        setDiscussionTimeLeft((prev) => {
          if (prev <= 1) {
            setCurrentPhase(GAME_PHASES.SELECTION);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearTimeout(timer);
  }, [currentPhase, discussionTimeLeft]);

  // 选择阶段倒计时
  useEffect(() => {
    let timer: number;

    if (currentPhase === GAME_PHASES.SELECTION && selectionTimeLeft > 0) {
      timer = setTimeout(() => {
        setSelectionTimeLeft((prev) => prev - 1);
      }, 1000);
    }

    return () => clearTimeout(timer);
  }, [currentPhase, selectionTimeLeft]);

  /**
   * 手动切换到选择阶段
   */
  const goToSelection = (): void => {
    setCurrentPhase(GAME_PHASES.SELECTION);
  };

  /**
   * 处理提交行动
   */
  const handleSubmitAction = (): void => {
    if (selectedAction) {
      const action: PlayerAction = {
        playerName: playerName,
        actionType: "decision",
        action: selectedAction,
        round: currentRound,
        timestamp: new Date().toISOString(),
      };
      handleActionSubmit(action);
      setHasSubmitted(true);
    }
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
          <Discussion
            discussionTimeLeft={discussionTimeLeft}
            onGoToSelection={() => setCurrentPhase(GAME_PHASES.SELECTION)}
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
            selectionTimeLeft={selectionTimeLeft}
            players={players}
            playerActions={playerActions}
            getRoleImage={getRoleImage}
            onShowEventModal={() => setShowEventModal(true)}
            onShowPrivateModal={() => setShowPrivateModal(true)}
            onSelectAction={setSelectedAction}
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
    <>
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
    </>
  );
}

export default GamePlay;
