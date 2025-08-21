import { useState } from "react";
import { useGameState } from "../../context/StateContext";
import { Button } from "../Button";
import { PlayerStatusCard } from "./PlayerStatusCard";
import { PrivateInfo } from "./PrivateInfo";

interface SelectionProps {
  onShowEventModal: () => void;
  onShowPrivateModal: () => void;
}

/**
 * 4. 选择确认阶段组件
 */
export const Selection = ({ onShowPrivateModal }: SelectionProps) => {
  const { game, room } = useGameState();
  const [selectedAction, setSelectedAction] = useState<string>("");

  const hasPlayerSubmitted =
    !!game.state.rounds[game.state.current_round].player_actions[room.player];

  return (
    <div className="flex-1 w-full bg-stone-950 overflow-hidden flex flex-col p-4">
      {/* 所有玩家选择状态 */}
      {room.state.players && room.state.players.length > 0 && (
        <div className="mb-8">
          {/* 玩家状态 */}
          <div className="flex justify-center">
            <div className="flex gap-6">
              {/* 将玩家按当前玩家优先排序 */}
              {[...room.state.players]
                .sort((a, b) => {
                  const aIsCurrent = a.name === room.player;
                  const bIsCurrent = b.name === room.player;
                  if (aIsCurrent && !bIsCurrent) return -1;
                  if (!aIsCurrent && bIsCurrent) return 1;
                  return 0;
                })
                .map((player) => {
                  return (
                    <PlayerStatusCard
                      key={player.name}
                      player={player.name}
                      hasSubmitted={
                        !!game.state.rounds[game.state.current_round]
                          .player_actions[player.name]
                      }
                    />
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* 私人信息 - 全宽度，用户头像在右上角 */}
      {game.state.rounds[game.state.current_round].private_messages &&
        game.state.rounds[game.state.current_round].private_messages[
          String(game.state.roles[room.player]).toUpperCase()
        ] && (
          <PrivateInfo
            privateMessages={
              game.state.rounds[game.state.current_round].private_messages
            }
            playerRole={game.state.roles[room.player]}
            onShowPrivateModal={onShowPrivateModal}
          />
        )}

      {/* 选择提示 */}
      <div className="text-center mb-8">
        <div className="opacity-60 text-white text-lg font-normal font-['Cactus_Classical_Serif'] uppercase leading-none">
          请做出你的选择
        </div>
      </div>

      {/* 选择选项 */}
      <div className="flex-1 px-4 mb-6">
        <div className="flex flex-col gap-4 max-w-sm mx-auto">
          {game.state.rounds[game.state.current_round].decision_options ? (
            Object.entries(
              game.state.rounds[game.state.current_round].decision_options
            ).map(([key, action]) => (
              <div
                key={key}
                className={`h-16 px-6 py-2.5 rounded-md flex items-center justify-center cursor-pointer transition-all ${
                  selectedAction === key ? "bg-white" : "bg-neutral-700"
                }`}
                onClick={() => setSelectedAction(key)}
              >
                <div
                  className={`text-center text-lg font-normal font-['Cactus_Classical_Serif'] leading-tight ${
                    selectedAction === key ? "text-black" : "text-white"
                  }`}
                >
                  {key}.{String(action)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-white text-center">选项加载中...</div>
          )}
        </div>
      </div>

      {/* 底部按钮和倒计时 */}
      <div className="flex flex-col items-center pb-8 space-y-4">
        {!hasPlayerSubmitted ? (
          <Button onClick={() => game.handleRoundAction(selectedAction)}>
            确认
          </Button>
        ) : (
          <div className="text-center">
            <div className="text-green-400 text-xl font-bold mb-2">
              ✅ 已提交选择
            </div>
            {game.state.current_round < 5 ? (
              <div className="text-white">等待其他玩家...</div>
            ) : (
              <div className="text-white">
                {game.state.current_round >= 5
                  ? "等待生成最终结果..."
                  : "所有玩家已提交，正在进入下一轮..."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
