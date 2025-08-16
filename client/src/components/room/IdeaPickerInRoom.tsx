import { useState, FormEvent } from "react";
import { Button } from "../Button";
import { useGame } from "../../context/GameContext";

/**
 * 游戏大厅组件
 * 用户输入创业想法的页面
 */
function IdeaPickerInRoom() {
  const { handleStartupIdeaSubmit, handleExitRoom, currentRoom, players } =
    useGame();
  const handleSubmit = handleStartupIdeaSubmit;
  const [startupIdea, setStartupIdea] = useState<string>("");
  const [ideaSubmitted, setIdeaSubmitted] = useState<boolean>(false);

  /**
   * 处理提交创业想法
   */
  const handleSubmitIdea = (): void => {
    if (startupIdea.trim()) {
      handleSubmit(startupIdea.trim());
      setIdeaSubmitted(true);
    }
  };

  /**
   * 随机生成创业想法
   */
  const handleRandomGenerate = (): void => {
    const randomIdeas = [
      "没有，谢谢",
      "基于区块链的数字身份验证系统",
      "虚拟现实教育培训平台",
      "智能家居能源管理系统",
      "社交化的技能学习交换平台",
      "环保材料的3D打印服务",
      "AI辅助的心理健康咨询应用",
    ];
    const randomIdea =
      randomIdeas[Math.floor(Math.random() * randomIdeas.length)];
    setStartupIdea(randomIdea);
  };

  /**
   * 处理文本框输入事件，自动调整高度
   * @param e - 表单事件
   */
  const handleTextareaInput = (e: FormEvent<HTMLTextAreaElement>): void => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = "auto";
    target.style.height = target.scrollHeight + "px";
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden flex flex-col justify-center p-6 relative">
      {/* 退出房间按钮 */}
      <button
        onClick={handleExitRoom}
        className="absolute top-4 left-4 flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 text-sm font-normal font-['Cactus_Classical_Serif']"
        disabled={ideaSubmitted}
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
                      player.is_online ? "bg-green-400" : "bg-red-400"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center space-y-8">
        {/* 输入区域 */}
        <div className="w-full max-w-sm">
          <div className="relative">
            <div className="w-1 h-8 bg-zinc-300 animate-pulse absolute left-0 top-0" />
            <textarea
              value={startupIdea}
              onChange={(e) => setStartupIdea(e.target.value)}
              placeholder="你的项目是..."
              className="bg-transparent border-none outline-none text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-relaxed placeholder-white w-full resize-none overflow-hidden pl-4"
              disabled={ideaSubmitted}
              rows={3}
              style={{
                minHeight: "80px",
                height: "auto",
              }}
              onInput={handleTextareaInput}
            />
          </div>
        </div>

        {/* 随机生成按钮 */}
        {!startupIdea.trim() && (
          <button
            onClick={handleRandomGenerate}
            className="text-white/70 text-base font-normal font-['Cactus_Classical_Serif'] hover:text-white transition-colors cursor-pointer"
          >
            随机生成
          </button>
        )}

        {/* 确认按钮 */}
        <div className="mt-8">
          <Button
            onClick={handleSubmitIdea}
            disabled={!startupIdea.trim() || ideaSubmitted}
          >
            {ideaSubmitted ? "已提交" : "确认"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default IdeaPickerInRoom;
