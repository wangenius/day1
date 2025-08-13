import { useEffect, useState } from "react";
import { useGame } from "../context/GameContextCore";
import type { Player } from "../const/const";

/**
 * 当前视图类型
 */
type CurrentView = "loading" | "video1" | "video2";

/**
 * Video1组件属性
 */
interface Video1Props {
  /** 视频播放结束回调 */
  onEnded: () => void;
}

/**
 * 角色信息接口
 */
interface RoleInfo {
  /** 角色ID */
  id: string;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description: string;
}

/**
 * 游戏加载页面组件
 * 显示玩家角色信息和过渡动画
 */
function GameLoadingPage() {
  const { playerName, roleDefinitions, players } = useGame();
  const [currentView, setCurrentView] = useState<CurrentView>("loading");

  /**
   * 获取当前玩家的角色信息
   * @returns 角色信息或null
   */
  const getCurrentPlayerRole = (): RoleInfo | null => {
    if (!roleDefinitions || !playerName) return null;

    // 从players数组中找到当前玩家
    const currentPlayer = players.find((player: Player) => player.name === playerName);
    if (!currentPlayer || !currentPlayer.role) return null;

    // 根据玩家选择的角色ID获取角色信息
    const roleId = currentPlayer.role;
    if (roleDefinitions[roleId]) {
      return {
        id: roleId,
        name: roleDefinitions[roleId].name || roleId,
        description: roleDefinitions[roleId].description || "",
      };
    }
    return null;
  };

  const currentRole = getCurrentPlayerRole();
  const roleName = currentRole ? currentRole.name : playerName;

  useEffect(() => {
    // 2秒后切换到video1
    const timer = setTimeout(() => {
      setCurrentView("video1");
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  /**
   * 处理video1播放结束后切换到video2
   */
  const handleVideo1Ended = (): void => {
    setCurrentView("video2");
  };

  // 根据当前状态渲染不同的视图
  if (currentView === "video1") {
    return <Video1 onEnded={handleVideo1Ended} />;
  }

  if (currentView === "video2") {
    return <Video2 />;
  }

  // 默认显示加载页面
  return (
    <div className="min-h-screen w-full bg-black overflow-hidden relative flex flex-col items-center justify-center p-4">
      {/* 右上角玩家名称 */}
      <div className="absolute top-4 right-4 text-right text-white text-sm font-medium font-['Space_Grotesk'] [text-shadow:_0px_2px_1px_rgb(0_0_0_/_0.25)]">
        {roleName}
      </div>

      {/* 主要内容容器 */}
      <div className="w-full max-w-sm mx-auto flex flex-col items-center space-y-6">
        {/* 角色图片 */}
        <img
          className="w-full max-w-xs h-48 object-cover rounded-lg"
          src={`/${currentRole?.id || 'CEO'}.png`}
          alt={`${currentRole?.name || 'CEO'}角色`}
        />

        {/* 游戏规则说明 */}
        <div className="text-center text-white text-lg font-normal font-['Cactus_Classical_Serif'] leading-relaxed mb-4">
          <div className="text-yellow-300 text-xl mb-2">游戏规则</div>
          每个角色都有双重任务：
          <br />
          <span className="text-green-300">让公司变得更好</span> + <span className="text-blue-300">让自己职业生涯变得更好</span>
        </div>

        {/* 角色名称 */}
        <div className="text-center text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-relaxed">
          你是{roleName}
        </div>

        {/* 任务描述 */}
        <div className="text-center text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-relaxed">
          你的目标是平衡两个任务
          <br />
          带领公司成功上市，估值一千万！
        </div>

        {/* 加载动画和"即将开始"文字 */}
        <div className="flex flex-col items-center space-y-4">
          <video
            className="w-24 h-24"
            src="/videoExport-2025-07-26@12-08-48.606-540x540@60fps.mp4"
            autoPlay
            loop
            controls={false}
          />
          <div className="text-center text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-relaxed">
            即将开始
          </div>
        </div>

        {/* 进度条 */}
        <div className="w-full max-w-xs relative">
          <div className="w-full h-[3px] bg-neutral-400 rounded-[1px]" />
          <div className="w-0.5 h-[3px] absolute top-0 left-0 bg-slate-300 rounded-[1px]" />
        </div>
      </div>
    </div>
  );
}

/**
 * Video1组件 - 第一个过渡视频
 */
function Video1({ onEnded }: Video1Props) {
  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden relative flex flex-col">
      {/* 状态栏 */}
      <div className="w-full h-12 relative overflow-hidden flex justify-between items-center px-6">
        <div className="w-14 h-6 rounded-[34.44px] relative">
          <div className="w-8 h-3 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white" />
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-6 h-3 opacity-30 rounded-[2.87px] border border-white" />
          <div className="w-[1.43px] h-1 opacity-40 bg-white" />
          <div className="w-5 h-2 bg-white rounded-sm" />
        </div>
      </div>

      {/* 视频 */}
      <video
        className="w-full flex-1 object-cover"
        src="/first scene.mp4"
        autoPlay
        muted
        controls={false}
        onEnded={onEnded}
      />

      {/* 文字描述 */}
      <div className="p-6 text-center text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-loose">
        故事始于一阵短暂而耀眼的黑客松胜利。那是一场持续48小时不眠不休的鏖战，在评委念出他们团队名字的瞬间，一切的疲惫都化作了震耳欲聋的欢呼与香槟泡沫。
      </div>
    </div>
  );
}

/**
 * Video2组件 - 第二个过渡视频
 */
function Video2() {
  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden relative flex flex-col">
      {/* 状态栏 */}
      <div className="w-full h-12 relative overflow-hidden flex justify-between items-center px-6">
        <div className="w-14 h-6 rounded-[34.44px] relative">
          <div className="w-8 h-3 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white" />
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-6 h-3 opacity-30 rounded-[2.87px] border border-white" />
          <div className="w-[1.43px] h-1 opacity-40 bg-white" />
          <div className="w-5 h-2 bg-white rounded-sm" />
        </div>
      </div>

      {/* 视频 */}
      <video
        className="w-full flex-1 object-cover"
        src="/second scene.mp4"
        autoPlay
        muted
        controls={false}
      />

      {/* 文字描述 */}
      <div className="p-6 text-center text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-loose">
        但优胜的甘甜味道很快在舌尖散去。真正的战场，是在深夜的办公间——伴随着速溶咖啡的苦涩和白板上反复修改的草图。团队带着黑客松的奖金，和对未来的憧憬，在这里开始锻造他们的第一个产品原型。
      </div>
    </div>
  );
}

export default GameLoadingPage;
