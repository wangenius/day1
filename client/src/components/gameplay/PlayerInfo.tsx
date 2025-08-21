import { useGameState } from "@/context/StateContext";

interface PlayerInfoProps {
  playerName: string;
  showRoleBelow?: boolean;
  size?: "small" | "medium" | "large";
}

/**
 * 玩家信息组件 - 显示玩家头像、姓名和角色
 * 重新设计的版本，提供更好的布局和响应式支持
 */
export const PlayerInfo = ({
  playerName,
  showRoleBelow = false,
  size = "large",
}: PlayerInfoProps) => {
  const { game } = useGameState();
  const playerRole = game.state.roles[playerName];
  // 根据尺寸设置样式配置
  const sizeConfig = {
    small: {
      container: "w-20 h-20",
      image: "w-16 h-16",
      glow: "w-12 h-12",
      nameSize: "text-xs",
      roleSize: "text-[10px]",
      padding: "px-2 py-1",
      spacing: "space-y-0.5",
    },
    medium: {
      container: "w-28 h-28",
      image: "w-24 h-24",
      glow: "w-20 h-20",
      nameSize: "text-sm",
      roleSize: "text-xs",
      padding: "px-3 py-1.5",
      spacing: "space-y-1",
    },
    large: {
      container: "w-36 h-36",
      image: "w-32 h-32",
      glow: "w-28 h-28",
      nameSize: "text-base",
      roleSize: "text-sm",
      padding: "px-4 py-2",
      spacing: "space-y-1.5",
    },
  };

  const config = sizeConfig[size];

  return (
    <div className="flex flex-col items-center">
      {/* 头像容器 */}
      <div
        className={`relative ${config.container} flex items-center justify-center mb-2`}
      >
        {/* 背景发光效果 */}
        <div
          className={`absolute ${config.glow} bg-gradient-to-br from-blue-400/20 via-purple-400/15 to-white/10 blur-2xl rounded-full animate-pulse`}
          style={{
            animation: "pulse 3s ease-in-out infinite",
            filter: "blur(20px)",
          }}
        />

        {/* 头像图片 */}
        <img
          className={`${config.image} relative z-10 rounded-full border-2 border-white/20 shadow-lg object-cover transition-all duration-300 hover:border-white/40 hover:shadow-xl`}
          src={`/image_${playerRole.toLowerCase()}.png`}
          alt={`${playerName} - ${playerRole}`}
        />

        {/* 角色徽章（当不在下方显示时） */}
        {!showRoleBelow && (
          <div className="absolute -bottom-1 -right-1 z-20">
            <div
              className={`bg-gradient-to-br from-stone-800 to-stone-900 border border-white/20 rounded-lg ${config.padding} backdrop-blur-sm shadow-lg`}
            >
              <div
                className={`text-white ${config.roleSize} font-medium opacity-90 whitespace-nowrap`}
              >
                {playerRole}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 玩家信息 */}
      <div className={`text-center ${config.spacing} max-w-full`}>
        <div
          className={`text-white ${config.nameSize} font-semibold font-['Space_Grotesk'] drop-shadow-sm truncate px-1`}
        >
          {playerName}
        </div>

        {showRoleBelow && (
          <div
            className={`text-white/80 ${config.roleSize} font-normal font-['Space_Grotesk'] uppercase tracking-wide truncate px-1`}
          >
            {playerRole}
          </div>
        )}
      </div>
    </div>
  );
};
