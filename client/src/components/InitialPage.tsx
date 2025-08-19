import { useGame } from "../context/GameContext";

/**
 * 初始页面组件
 * 游戏的启动页面，点击任意位置进入欢迎页面
 */
export function InitialPage() {
  const { room } = useGame();

  return (
    <div
      className="min-h-screen w-full bg-stone-950 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity flex flex-col justify-between p-4"
      onClick={() => {
        console.log(room.player);
        if (!room.player) {
          room.setRoomState("username");
        } else {
          room.setRoomState("entrance");
        }
      }}
    >
      {/* 顶部Day1标签 */}
      <div className="flex justify-center pt-8">
        <div className="w-28 h-28 bg-white rounded-[20px] flex items-center justify-center">
          <div className="text-black text-4xl font-normal font-['IdeaFonts_YouQiTi']">
            Day1
          </div>
        </div>
      </div>

      {/* 中间标题区域 */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <div className="text-white text-2xl font-normal font-['Cactus_Classical_Serif'] text-center">
          创业模拟器
        </div>
        <div className="text-rose-400 text-xl font-normal font-['Jamies_Hand'] capitalize transform rotate-12">
          No pressure
        </div>
      </div>

      {/* 底部角色图片区域 */}
      <div className="relative h-48 flex items-end justify-center">
        <div className="relative w-full max-w-sm">
          {/* 主要角色图片 */}
          <img
            className="w-32 h-32 mx-auto relative z-10"
            src="./image (1).png"
            alt="主角色"
          />
          {/* 背景角色图片 */}
          <img
            className="w-28 h-28 absolute left-4 bottom-0 opacity-70"
            src="./image (2).png"
            alt="角色2"
          />
          <img
            className="w-24 h-24 absolute left-0 bottom-4 opacity-50"
            src="./image (3).png"
            alt="角色3"
          />
          <img
            className="w-20 h-20 absolute right-4 bottom-0 opacity-70"
            src="./image (4).png"
            alt="角色4"
          />
        </div>
      </div>
    </div>
  );
}
