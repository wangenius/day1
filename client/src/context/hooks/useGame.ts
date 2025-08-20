import { useCallback, useEffect, useState } from "react";
import { GameInfo, GameState } from "../../const/types";
import type { RoomState, UseRoomReturn } from "./useRoom";
import type { UseWebSocketReturn } from "./useWebSocket";

/**
 * 游戏状态 Hook 参数接口
 */
export interface UseGameParams {
  /** 房间管理对象 */
  room: UseRoomReturn;
  /** WebSocket 管理对象 */
  webSocket: UseWebSocketReturn;
}

/**
 * 游戏状态 Hook 返回值接口
 * 定义了整个游戏应用中所有状态数据和操作方法
 */
export interface UseGameReturn {
  // ========== 基础状态 ==========
  /** 当前游戏的主要状态（如INITIAL、WELCOME、LOBBY、PLAYING等） */
  state: GameInfo;
  /** 重置所有游戏相关状态到初始值 */
  resetGameState: () => void;
  handleStartupIdeaSubmit: (idea: string) => void;
  handleRoleSelect: (roleId: string) => void;
  handleRoundAction: (action: string) => void;
  handleStartRound: () => void;
  handleLoadingComplete: () => void;
  handleRestartGame: () => void;
}

export const DefaultGameState: GameInfo = {
  state: GameState.PLAYING,
  result: {
    report: "",
  },
  ideas: {},
  selected_idea: "",
  roles: {},
  background: "",
  rounds: {},
  current_round: 1,
};

/**
 * 游戏状态管理 Hook
 *
 * 这是整个游戏应用的核心状态管理 Hook，集中管理所有游戏相关的状态数据。
 * 它提供了游戏从开始到结束整个流程中需要的所有状态变量和状态操作方法。
 *
 * 主要功能：
 * - 管理游戏基础状态（当前状态、玩家信息、房间信息等）
 * - 管理游戏进行状态（轮次、事件、行动、结果等）
 * - 管理前端UI状态（阶段、弹窗、倒计时等）
 * - 提供数据规范化和本地存储功能
 * - 提供系统消息管理功能
 *
 * 设计特点：
 * - 采用单一状态源原则，所有状态都在这里集中管理
 * - 提供完整的状态更新方法，支持函数式更新
 * - 包含工具函数，处理数据转换和持久化
 * - 状态分类清晰，便于理解和维护
 *
 * @param params - Hook所需的参数对象
 * @returns 返回所有状态数据和操作方法的对象
 *
 * @example
 * ```tsx
 * const gameState = useGameState(params);
 *
 * // 使用状态
 * const { currentRound, roundEvent, gameState: currentState } = gameState;
 *
 * // 更新状态
 * gameState.setCurrentRound(2);
 * gameState.setGameState(GAME_UX_PAGEING.PLAYING);
 * ```
 */
export function useGame(params: UseGameParams): UseGameReturn {
  const { room, webSocket } = params;

  const [state, setState] = useState<GameInfo>(DefaultGameState);

  /**
   * 重置游戏状态
   * 将所有游戏相关状态重置为初始值
   */
  const resetGameState = useCallback((): void => {
    setState(DefaultGameState);
  }, []);

  /**
   * 处理创业想法提交
   * @param idea - 玩家提交的创业想法
   */
  const handleStartupIdeaSubmit = useCallback(
    (idea: string): void => {
      if (webSocket.connected) {
        webSocket.send({
          type: "startup_idea",
          data: { idea },
        });
      }
    },
    [webSocket]
  );

  /**
   * 处理角色选择
   * @param roleId - 选择的角色ID
   */
  const handleRoleSelect = useCallback(
    (roleId: string): void => {
      if (webSocket.connected) {
        console.log(`🎭 步骤2: WebSocket连接正常，准备发送角色选择消息`);

        webSocket.send({
          type: "select_role",
          data: { role: roleId },
        });

        console.log(`🎭 完成: 角色选择流程完成，等待服务器确认`);
      } else {
        // 步骤2.alt: WebSocket未连接的错误处理
        console.error(`🎭 步骤2.alt: WebSocket未连接，无法发送角色选择消息`);
        console.error(
          `🎭 步骤2.alt: 连接状态 - 已连接: ${webSocket.connected}`
        );
      }
    },
    [webSocket]
  );

  /**
   * 处理开始轮次
   * 从加载状态切换到游戏中状态
   */
  const handleStartRound = useCallback((): void => {
    setState((prevState: GameInfo) => {
      return { ...prevState, state: GameState.PLAYING };
    });
  }, []);

  /**
   * 处理加载完成后开始游戏
   * 设置初始轮次并开始游戏
   */
  const handleLoadingComplete = useCallback((): void => {
    setState((prevState: GameInfo) => {
      return { ...prevState, state: GameState.PLAYING };
    });
  }, []);

  /**
   * 处理重新开始游戏
   * 如果有WebSocket连接则发送重启消息，否则本地重置
   */
  const handleRestartGame = useCallback((): void => {
    if (webSocket.connected) {
      webSocket.send({ type: "restart_game", data: {} });
    } else {
      resetGameState();
    }
  }, [webSocket, resetGameState]);

  /**
   * 提交当前选择
   */
  const handleRoundAction = useCallback(
    (action: string): void => {
      console.log("提交当前选择",action);
      console.log(webSocket.connected);
      if (webSocket.connected) {
        console.log("提交当前选择",action);
        webSocket.send({
          type: "game_action",
          data: {
            playerName: room.player,
            actionType: "decision",
            action: action,
            round: state.current_round,
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
    [room.player, webSocket.connected]
  );

  useEffect(() => {
    if (!webSocket.connected) return;
    webSocket.listen((message) => {
      if (message.type === "game_state") {
        const data = message.data as {
          room_state: RoomState;
          game_state: GameInfo;
        };

        console.log(data);
        room.setRoomState(data.room_state);
        setState((prevState: GameInfo) => {
          return { ...prevState, ...data.game_state };
        });
      }
    });
  }, [webSocket.connected]);

  return {
    state,
    resetGameState,
    handleStartupIdeaSubmit,
    handleRoleSelect,
    handleStartRound,
    handleLoadingComplete,
    handleRestartGame,
    handleRoundAction,
  };
}
