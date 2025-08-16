import { useGame } from "../../context/GameContext";
import { Button } from "../Button";

export function RoomLobby() {
  const { players, currentRoom, handleRoomAction, handleExitRoom } = useGame();
  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden flex flex-col justify-center p-6 relative">
      {/* 退出房间按钮 */}
      <button
        onClick={handleExitRoom}
        className="absolute top-4 left-4 flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 text-sm font-normal font-['Cactus_Classical_Serif']"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16,17 21,12 16,7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        退出房间
      </button>

      {/* 房间信息 */}
      <div className="absolute top-4 right-4 text-right">
        {/* 房间号 */}
        <div className="text-white/70 text-sm font-normal font-['Cactus_Classical_Serif'] mb-2">
          房间号: <span className="text-white">{currentRoom}</span>
        </div>

        {/* 玩家列表 */}
        <div className="text-white/70 text-sm font-normal font-['Cactus_Classical_Serif']">
          <div className="mb-1">在线玩家 ({players.length}):</div>
          <div className="space-y-1">
            {players.map((player, index) => (
              <div key={index} className="flex items-center justify-end gap-2">
                <span className="text-white">{player.name}</span>
                <div className="flex items-center gap-1">
                  {/* 连接状态指示器 */}
                  <div
                    className={`w-2 h-2 rounded-full ${
                      player.online ? "bg-green-400" : "bg-red-400"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* 房间号 */}
      <div className="text-white/70 text-sm font-normal font-['Cactus_Classical_Serif'] mb-2">
        房间号: <span className="text-white">{currentRoom}</span>
      </div>

      {/* 玩家列表 */}
      <div className="text-white/70 text-sm font-normal font-['Cactus_Classical_Serif']">
        <Button
          onClick={() => {
            handleRoomAction("start_game", currentRoom);
          }}
        >
          开始游戏
        </Button>
      </div>
    </div>
  );
}
