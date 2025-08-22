import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { GameResult as GameResultType } from "../const/const";
import { useGameState } from "../context/StateContext";

/**
 * 打印机效果组件属性
 */
interface PrinterEffectProps {
  /** 是否正在打印 */
  isPrinting: boolean;
  /** 打印进度 */
  printProgress: number;
  /** 开始打印回调 */
  onStartPrint: () => void;
  /** 重新开始回调 */
  onRestart: () => void;
  /** 游戏结果 */
  gameResult: GameResultType | null;
}

/**
 * 游戏结果组件
 * 显示游戏结束后的结果和打印效果
 */
function GameResult() {
  const { game } = useGameState();
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printProgress, setPrintProgress] = useState<number>(0);

  console.log(game.state.result);

  // 检查是否有报告内容
  const hasReport = game.state.result?.report && game.state.result.report.trim() !== "";

  useEffect(() => {
    // 只有当有报告内容时才开始打印动画
    if (hasReport) {
      const startTimer = setTimeout(() => {
        setIsPrinting(true);
      }, 5000);

      return () => clearTimeout(startTimer);
    }
  }, [hasReport]);

  useEffect(() => {
    if (isPrinting) {
      // 打印动画，3秒内从0到100
      const interval = setInterval(() => {
        setPrintProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2; // 每50ms增加2%
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [isPrinting]);

  /**
   * 处理开始打印
   */
  const handleStartPrint = (): void => {
    setIsPrinting(true);
  };

  /**
   * 处理重新开始
   */
  const handleRestart = (): void => {
    setIsPrinting(false);
    setPrintProgress(0);
    game.handleRestartGame();
  };

  // 如果没有报告内容，显示加载动画
  if (!hasReport) {
    return (
      <div className="min-h-screen w-full bg-stone-950 flex flex-col items-center justify-center">
        <div className="text-center text-white mb-8">
          <div className="text-xl font-normal font-['Cactus_Classical_Serif'] leading-relaxed mb-4">
            正在生成创业报告...
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <PrinterEffect
        isPrinting={isPrinting}
        printProgress={printProgress}
        onStartPrint={handleStartPrint}
        onRestart={handleRestart}
        gameResult={game.state.result}
      />
    </div>
  );
}

/**
 * 打印机效果组件
 * 模拟打印机打印报告的效果
 */
function PrinterEffect({
  isPrinting,
  printProgress,
  onStartPrint,
  onRestart,
  gameResult,
}: PrinterEffectProps) {
  const handleExport = (): void => {
    const content = gameResult?.report ?? "";
    if (!content) return;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `final_report_${dateStr}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden relative flex flex-col">
      {/* 打印机背景 */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md z-0">
        <img
          className="w-full h-auto object-contain"
          src="./print.png"
          alt="打印机"
        />
      </div>

      {/* 右上角导出按钮 */}
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={handleExport}
          disabled={!gameResult?.report}
          className="bg-white text-black px-4 py-2 rounded-lg shadow hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          导出
        </button>
      </div>

      {/* 初始状态内容 */}
      {!isPrinting && (
        <div className="flex-1 flex flex-col items-center justify-center z-10 p-4">
          <div className="text-center text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-relaxed mb-8">
            五个月过去了
            <br />
            你们4个人的小团队
          </div>

          {/* 手动开始按钮 */}
          <button
            onClick={onStartPrint}
            className="bg-white text-black px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            开始打印报告
          </button>
        </div>
      )}

      {/* 打印中的纸张效果 */}
      {isPrinting && (
        <div className="flex-1 flex items-center justify-center z-10 p-4">
          {/* 打印纸张 */}
          <div
            className="w-full max-w-sm bg-gradient-to-b from-gray-200 to-zinc-100 rounded-sm relative transition-all duration-300 ease-out mx-auto"
            style={{
              height: `${Math.min(printProgress * 6, 600)}px`,
              transform: `translateY(${Math.max(
                150 - printProgress * 1.5,
                0
              )}px)`,
            }}
          >
            {/* Day1 标签 */}
            {printProgress > 10 && (
              <div className="absolute left-2 top-2 transform w-10 h-10 bg-white rounded-md flex items-center justify-center animate-fadeIn">
                <span className="text-black text-sm font-normal font-['IdeaFonts_YouQiTi']">
                  Day1
                </span>
              </div>
            )}

            {/* 打印内容 - 逐步显示 */}
            <div className="p-6 text-zinc-800 text-base font-normal font-['Cactus_Classical_Serif'] leading-relaxed space-y-3 overflow-y-auto max-h-[500px]">
              {printProgress > 20 && (
                <div className="text-center font-semibold text-lg mb-4 animate-slideDown">
                  创业结局报告
                </div>
              )}

              {gameResult?.report && (
                <div className="markdown prose prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-xl font-bold text-primary mb-3">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-lg font-semibold text-primary mb-2">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-base font-medium text-primary mb-2">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-3 leading-relaxed">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-3 pl-4 space-y-1">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-3 pl-4 space-y-1 list-decimal">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-zinc-700 leading-relaxed">
                          {children}
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-zinc-600">{children}</em>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-zinc-300 pl-4 my-3 text-zinc-600 italic">
                          {children}
                        </blockquote>
                      ),
                      code: ({ children }) => (
                        <code className="bg-zinc-100 text-zinc-800 px-1 py-0.5 rounded text-sm font-mono">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="bg-zinc-100 p-3 rounded overflow-x-auto mb-3">
                          {children}
                        </pre>
                      ),
                    }}
                  >
                    {gameResult.report}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 底部标题和重新开始按钮 - 打印完成后显示 */}
      {printProgress >= 100 && (
        <div className="flex flex-col items-center justify-center pb-8 text-center z-20 animate-fadeIn">
          <div className="text-zinc-600 text-2xl font-normal font-['FZLanTingHeiS-H-GB'] leading-loose tracking-[3.84px] mb-4">
            创业报告
          </div>
          <button
            onClick={onRestart}
            className="bg-white text-black px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium shadow-lg"
          >
            重新开始
          </button>
        </div>
      )}

      {/* 打印进度指示器 */}
      {isPrinting && printProgress < 100 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg z-30">
          <div className="text-sm mb-1">
            正在打印... {Math.round(printProgress)}%
          </div>
          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100 ease-out"
              style={{ width: `${printProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default GameResult;
