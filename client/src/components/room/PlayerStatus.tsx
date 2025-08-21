import { useGameState } from "@/context/StateContext";

interface PlayerStatusCardProps {
  player: string;
  hasSubmitted: boolean;
}

/**
 * 玩家状态卡片组件 - 极简版本
 */
export const PlayerStatus = ({
  player,
  hasSubmitted,
}: PlayerStatusCardProps) => {
  const { room } = useGameState();

  const isCurrentPlayer = player === room.player;

  return (
    <div className="flex items-center space-x-2">
      {/* 头像 */}
      <div className="relative">
        <div
          className={`w-4 h-4 flex items-center justify-center rounded-full border-2 transition-opacity duration-200 text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-relaxed ${
            hasSubmitted
              ? "border-green-400"
              : isCurrentPlayer
              ? "border-blue-400"
              : "border-gray-600"
          } ${hasSubmitted || isCurrentPlayer ? "opacity-100" : "opacity-60"}`}
        ></div>

        {/* 简单的状态指示 */}
        {hasSubmitted && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-green-400/90 rounded-full flex items-center justify-center">
            <span className="text-white text-sm">✓</span>
          </div>
        )}
      </div>
      <div className="text-white/70 text-sm font-normal font-['Cactus_Classical_Serif']">
        {player}
      </div>
    </div>
  );
};
