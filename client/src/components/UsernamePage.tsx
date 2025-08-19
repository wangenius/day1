import { useState, FormEvent } from "react";
import { useGame } from "../context/GameContext";
import { Button } from "./Button";

/**
 * 欢迎页面组件
 * 用户输入用户名的页面
 */
function UserNamePage() {
  const { room } = useGame();
  const [playerName, setPlayerName] = useState<string>("");

  /**
   * 处理表单提交
   * @param e - 表单事件
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (playerName.trim()) {
      room.setPlayer(playerName.trim());
      room.setRoomState("entrance");
    }
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden flex flex-col justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center space-y-8"
      >
        {/* 输入区域 */}
        <div className="w-full max-w-sm">
          <div className="relative">
            <div className="w-1 h-8 bg-zinc-300 animate-pulse absolute left-0 top-0" />
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="bg-transparent border-none outline-none text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-relaxed placeholder-white w-full pl-4"
              placeholder="输入用户名"
              required
            />
          </div>
        </div>

        {/* 确定按钮 */}
        <div className="mt-16">
          <Button
            disabled={!playerName.trim()}
            onClick={() => handleSubmit(new Event("submit") as any)}
          >
            确定
          </Button>
        </div>
      </form>
    </div>
  );
}

export default UserNamePage;
