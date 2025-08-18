import { useGame } from "../../context/GameContext";
import { Button } from "../Button";

export function RoomLobby() {
  const { room, gameState } = useGame();

  // 获取当前玩家信息
  const currentPlayer = room.room?.players.find((p) => p.name === room.player);
  const isHost = currentPlayer?.is_host || false;

  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden flex flex-col justify-center p-6 relative">
      {/* 退出房间按钮 */}
      <button
        onClick={() => {
          room.leave();
        }}
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

      <div className="flex flex-col items-center space-y-8">
        {/* 标题 */}
        <div className="text-white text-xl font-normal font-['Cactus_Classical_Serif'] text-center mb-8">
          房间大厅
        </div>

        {/* 房间信息卡片 */}
        <div className="bg-stone-900 rounded-lg border border-white/20 p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-white/70 text-sm font-normal font-['Cactus_Classical_Serif'] mb-2">
              房间号
            </div>
            <div className="text-white text-2xl font-medium font-['Space_Grotesk']">
              {room.room?.id}
            </div>
          </div>

          {/* 玩家列表 */}
          <div className="mb-6">
            <div className="text-white/70 text-sm font-normal font-['Cactus_Classical_Serif'] mb-3">
              在线玩家 ({room.room?.players.length}/4)
            </div>
            <div className="space-y-2">
              {room.room?.players.map((player, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    player.name === room.player
                      ? "bg-white/10 border-white/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        player.is_online ? "bg-green-400" : "bg-red-400"
                      }`}
                    />
                    <span className="text-white text-sm font-medium">
                      {player.name}
                    </span>
                    {player.is_host && (
                      <span className="text-yellow-400 text-xs font-medium">
                        房主
                      </span>
                    )}
                  </div>
                  {player.name === room.player && (
                    <span className="text-white/60 text-xs">(你)</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 开始游戏按钮或等待提示 */}
          <div className="text-center flex justify-center">
            {isHost ? (
              <Button
                onClick={() => {
                  // gameState.start();
                }}
              >
                开始游戏
              </Button>
            ) : (
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <div className="text-white/70 text-sm font-normal font-['Cactus_Classical_Serif']">
                  ⏳ 等待房主开始游戏...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 游戏说明 */}
        <div className="text-white/50 text-xs font-normal font-['Cactus_Classical_Serif'] text-center max-w-md">
          游戏需要 1-4 名玩家才能开始
          <br />
          房主可以开始游戏，其他玩家需要等待
          <br />
          推荐线下或者线上开麦游戏
        </div>
      </div>
    </div>
  );
}
