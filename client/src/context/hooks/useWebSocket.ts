import { useCallback, useRef } from "react";
import {
  GAME_UX_PAGEING,
  type GameResult,
  type GameState,
  type Player,
  type PlayerAction,
  type RoleDefinition,
  type RoundEvent,
  type WebSocketMessage,
} from "../../const/const";

/**
 * WebSocket Hook 参数接口
 * 定义了 useWebSocket Hook 所需的所有参数，包括服务器配置、游戏状态和回调函数
 */
interface UseWebSocketParams {
  // ========== 服务器配置 ==========
  /** WebSocket 服务器的基础URL地址，用于建立WebSocket连接 */
  wsBaseUrl: string;
  /** HTTP API 服务器的基础URL地址，用于房间状态检查等HTTP请求 */
  httpBaseUrl: string;

  // ========== 当前游戏状态 ==========
  /** 当前登录的玩家名称，用于身份标识和消息处理 */
  playerName: string;
  /** 当前游戏进行的轮次编号，用于消息过滤和状态同步 */
  currentRound: number;
  /** 当前前端UI显示的阶段，用于避免UI抖动 */
  currentPhase: string;

  // ========== UI配置常量 ==========
  /** UI游戏阶段的常量定义，用于阶段切换和状态同步 */
  UI_GAME_PHASES: {
    /** 事件展示阶段 */
    EVENT_DISPLAY: string;
    /** 信息和选项阶段 */
    INFO_AND_OPTIONS: string;
    /** 讨论阶段 */
    DISCUSSION: string;
    /** 选择阶段 */
    SELECTION: string;
  };

  // ========== 状态更新函数 ==========
  /** 设置WebSocket连接状态的函数 */
  setWsConnected: (connected: boolean) => void;
  /** 设置当前房间ID的函数 */
  setCurrentRoom: (room: string) => void;
  /** 设置主游戏状态的函数 */
  setGameState: (state: GameState) => void;
  /** 设置当前轮次的函数 */
  setCurrentRound: (round: number) => void;
  /** 设置当前UI阶段的函数 */
  setCurrentPhase: (phase: string) => void;
  /** 设置剩余时间的函数 */
  setTimeLeft: (time: number) => void;
  /** 设置当前选择行动的函数 */
  setSelectedAction: (action: string) => void;
  /** 设置是否已提交状态的函数 */
  setHasSubmitted: (submitted: boolean) => void;
  /** 设置玩家列表的函数 */
  setPlayers: (players: Player[]) => void;
  /** 设置已选择角色列表的函数 */
  setSelectedRoles: (roles: string[]) => void;
  /** 设置当前轮次事件的函数 */
  setRoundEvent: (event: RoundEvent | null) => void;
  /** 设置私人消息的函数 */
  setPrivateMessages: (messages: Record<string, string>) => void;
  /** 设置玩家行动列表的函数 */
  setPlayerActions: (actions: PlayerAction[]) => void;
  /** 设置是否等待其他玩家的函数 */
  setWaitingForPlayers: (waiting: boolean) => void;
  /** 设置游戏结果的函数 */
  setGameResult: (result: GameResult | null) => void;
  /** 设置游戏背景故事的函数 */
  setGameBackground: (background: string | null) => void;
  /** 设置角色定义数据的函数 */
  setRoleDefinitions: (roles: Record<string, RoleDefinition> | null) => void;
  /** 重置游戏状态的函数 */
  resetGameState: () => void;
}

/**
 * WebSocket Hook 返回值接口
 * 定义了 useWebSocket Hook 返回给调用方的所有方法和引用
 */
interface UseWebSocketReturn {
  /**
   * WebSocket 连接的引用对象
   * 可以直接用于发送消息给服务器，或检查连接状态
   */
  wsRef: React.MutableRefObject<WebSocket | null>;
  /**
   * WebSocket 连接状态标志
   * 注意：实际连接状态由外部的 gameState.wsConnected 管理
   */
  wsConnected: boolean;
  /**
   * 建立 WebSocket 连接的方法
   * 创建新的WebSocket连接并处理连接生命周期事件
   * @param player - 玩家名称
   * @param roomId - 房间ID
   */
  connectWebSocket: (player: string, roomId: string) => void;
  /**
   * 用户重新连接到游戏的的异步方法
   * 如果玩家名称存在，则重新连接到对应的房间，否则
   * @param player - 玩家名称
   * @param roomId - 房间ID
   * @returns Promise
   */
  reconnectToRoom: (player: string) => Promise<void>;
  /**
   * 处理 WebSocket 消息的方法
   * 根据消息类型执行相应的状态更新和UI变化
   * @param message - WebSocket消息对象
   */
  handleWebSocketMessage: (message: WebSocketMessage) => void;
}

/**
 * WebSocket 管理 Hook
 *
 * 这个 Hook 负责管理与游戏服务器的 WebSocket 连接，处理实时通信和状态同步。
 * 它是整个游戏实时功能的核心，处理所有服务器推送的消息和状态更新。
 *
 * 主要功能：
 * - 建立和管理 WebSocket 连接
 * - 处理连接成功、断开、错误等事件
 * - 解析和分发服务器消息到相应的状态更新
 * - 支持断线重连和状态恢复
 * - 处理房间验证和状态同步
 * - 管理游戏过程中的实时消息流
 *
 * 消息处理类型：
 * - 玩家进出房间事件
 * - 游戏状态变化通知
 * - 轮次开始/结束事件
 * - 玩家行动同步
 * - 游戏结果通知
 * - 错误和异常处理
 *
 * 连接管理：
 * - 自动处理连接生命周期
 * - 支持重连验证和状态恢复
 * - 处理网络异常和连接错误
 * - 维护连接状态和心跳同步
 *
 * @param params - Hook所需的参数对象，包含服务器配置和状态更新函数
 * @returns 返回WebSocket连接引用和管理方法
 *
 * @example
 * ```tsx
 * const { wsRef, connectWebSocket, reconnectToRoom } = useWebSocket({
 *   wsBaseUrl: 'ws://localhost:3001',
 *   httpBaseUrl: 'http://localhost:3001',
 *   playerName: 'Player1',
 *   // ... 其他参数
 * });
 *
 * // 建立连接
 * connectWebSocket('Player1', 'room123');
 *
 * // 发送消息
 * wsRef.current?.send(JSON.stringify({
 *   type: 'game_action',
 *   data: { action: 'decision', ... }
 * }));
 * ```
 */
export function useWebSocket(params: UseWebSocketParams): UseWebSocketReturn {
  const {
    wsBaseUrl,
    httpBaseUrl,
    playerName,
    currentRound,
    currentPhase,
    UI_GAME_PHASES,
    setWsConnected,
    setCurrentRoom,
    setGameState,
    setCurrentRound,
    setCurrentPhase,
    setTimeLeft,
    setSelectedAction,
    setHasSubmitted,
    setPlayers,
    setSelectedRoles,
    setRoundEvent,
    setPrivateMessages,
    setPlayerActions,
    setWaitingForPlayers,
    setGameResult,
    setGameBackground,
    setRoleDefinitions,
    resetGameState,
  } = params;

  /** WebSocket连接引用 */
  const wsRef = useRef<WebSocket | null>(null);

  /**
   * 处理WebSocket接收到的消息
   * 根据消息类型执行相应的状态更新和UI变化
   * @param message - WebSocket消息对象
   */
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage): void => {
      switch (message.type) {
        // 玩家加入房间
        case "player_join": {
          setPlayers(message.data.players);
          // 只有当加入的不是当前玩家时才显示消息
          if (message.data.player_name !== playerName) {
          }
          break;
        }
        // 玩家离开房间
        case "player_leave":
          console.log(message);

          setPlayers(message.data.players);
          break;
        // 所有创业想法提交完成
        case "ideas_complete":
          setPlayers(message.data.players);
          setGameState(GAME_UX_PAGEING.ROLE_SELECTION);
          break;
        // 游戏加载中
        case "game_loading":
          setGameState(GAME_UX_PAGEING.LOADING);
          break;
        // 游戏开始，进入角色选择
        case "game_start": {
          console.log("GameContext - 收到game_start消息:", message);
          setGameState(GAME_UX_PAGEING.ROLE_SELECTION);
          // 设置游戏背景故事
          if (message.data && message.data.background) {
            console.log("GameContext - 设置背景故事:", message.data.background);
            setGameBackground(message.data.background as string);
          }
          // 设置角色定义
          if (message.data && message.data.roles) {
            console.log("GameContext - 设置角色定义:", message.data.roles);
            setRoleDefinitions(
              message.data.roles as Record<string, RoleDefinition>
            );
          } else {
            console.log("GameContext - 没有角色定义数据");
          }
          break;
        }
        // 过渡动画阶段
        case "transition_animation":
          console.log("GameContext - 收到transition_animation消息:", message);
          setGameState(GAME_UX_PAGEING.EVENT_GENERATION);
          if (message.data && message.data.background) {
            console.log("GameContext - 设置背景故事:", message.data.background);
            setGameBackground(message.data.background as string);
          }
          if (message.data && message.data.roles) {
            console.log("GameContext - 设置角色定义:", message.data.roles);
            setRoleDefinitions(
              message.data.roles as Record<string, RoleDefinition>
            );
          } else {
            console.log("GameContext - 没有角色定义数据");
          }
          break;
        // 有玩家选择了角色
        case "role_selected":
          console.log("GameContext - 收到role_selected消息:", message);
          setSelectedRoles(message.data.selectedRoles as string[]);
          setPlayers(message.data.players);
          break;
        // 所有角色选择完成
        case "roles_complete":
          break;
        // 游戏正式开始
        case "game_started":
          setGameState(GAME_UX_PAGEING.PLAYING);
          setCurrentRound(1);
          setCurrentPhase(UI_GAME_PHASES.EVENT_DISPLAY);
          setSelectedAction("");
          setHasSubmitted(false);
          setPlayerActions([]);
          setWaitingForPlayers(false);
          // 设置轮次事件
          if (message.data.roundEvent) {
            setRoundEvent(message.data.roundEvent as RoundEvent);
            // 检查是否使用了默认事件
            if (message.data.isDefaultEvent) {
            }
          }
          // 设置私人消息
          if (message.data.privateMessages) {
            setPrivateMessages(
              message.data.privateMessages as Record<string, string>
            );
          }
          break;
        // 轮次加载中
        case "round_loading":
          setGameState(GAME_UX_PAGEING.ROUND_LOADING);
          setCurrentRound(message.data.round as number);
          break;
        // 新轮次开始
        case "round_start":
          setGameState(GAME_UX_PAGEING.PLAYING);
          setCurrentRound(message.data.round as number);
          // 重置前端阶段/倒计时/提交态
          setCurrentPhase(UI_GAME_PHASES.EVENT_DISPLAY);
          setSelectedAction("");
          setHasSubmitted(false);
          // 更新轮次事件
          if (message.data.roundEvent) {
            setRoundEvent(message.data.roundEvent as RoundEvent);
            // 检查是否使用了默认事件
            if (message.data.isDefaultEvent) {
            }
          }
          // 更新私人消息
          if (message.data.privateMessages) {
            setPrivateMessages(
              message.data.privateMessages as Record<string, string>
            );
          }
          // 重置玩家行动和等待状态
          setPlayerActions([]);
          setWaitingForPlayers(false);
          break;
        // 玩家提交行动
        case "action_submitted":
          setPlayerActions(message.data.playerActions as PlayerAction[]);
          setWaitingForPlayers(message.data.waitingForPlayers as boolean);
          // 同步本地提交态（兼容断线重连/超时自动提交）
          try {
            const hasMe = (message.data.playerActions as PlayerAction[]).some(
              (a) => a.playerName === playerName && a.round === currentRound
            );
            setHasSubmitted(Boolean(hasMe));
          } catch {}
          // 若为第5轮且所有玩家已提交，但尚未收到服务器的 game_loading，先本地进入结算加载
          if (!message.data.waitingForPlayers && currentRound >= 5) {
            setGameState(GAME_UX_PAGEING.LOADING);
          }
          break;
        // 后端主导的UI阶段
        case "round_phase":
          // 若已经在选择阶段，忽略回退到较早阶段（如 info_and_options / discussion）的广播，避免 UI 抖动
          if (currentPhase === UI_GAME_PHASES.SELECTION) {
            break;
          }
          switch (message.data.phase as string) {
            case "event_display":
              setCurrentPhase(UI_GAME_PHASES.EVENT_DISPLAY);
              break;
            case "info_and_options":
              setCurrentPhase(UI_GAME_PHASES.INFO_AND_OPTIONS);
              break;
            case "discussion":
              // setCurrentPhase(UI_GAME_PHASES.DISCUSSION);
              break;
            case "selection":
              setCurrentPhase(UI_GAME_PHASES.SELECTION);
              break;
            default:
              break;
          }
          break;
        // 每秒后端心跳：同步整轮状态（单一真相源）
        case "round_tick": {
          const d = message.data as any;
          // 基本字段
          if (typeof d.round === "number") setCurrentRound(d.round);
          // 剩余时间：根据阶段设置（仅用于显示，不再本地倒计时推进阶段）
          if (typeof d.remaining === "number") {
            setTimeLeft(d.remaining);
          }
          // 同步当轮事件/私信
          if (d.roundEvent) setRoundEvent(d.roundEvent as RoundEvent);
          if (d.privateMessages)
            setPrivateMessages(d.privateMessages as Record<string, string>);
          // 同步行动/等待
          if (Array.isArray(d.playerActions))
            setPlayerActions(d.playerActions as PlayerAction[]);
          if (typeof d.waitingForPlayers === "boolean")
            setWaitingForPlayers(d.waitingForPlayers as boolean);
          // 用playerActions矫正本地 hasSubmitted
          try {
            const hasMe = (d.playerActions as PlayerAction[] | undefined)?.some(
              (a) =>
                a.playerName === playerName && a.round === (d.round as number)
            );
            setHasSubmitted(Boolean(hasMe));
          } catch {}
          // 玩家列表（用于头像/房主标记）
          if (Array.isArray(d.players)) setPlayers(d.players);
          break;
        }
        // 轮次结束
        case "round_complete":
          break;
        // 游戏结束
        case "game_complete":
          setGameState(GAME_UX_PAGEING.RESULT);
          setGameResult(message.data.result as GameResult);
          break;
        // 游戏重新开始
        case "game_restart":
          resetGameState();
          setPlayers(message.data.players);
          break;
        // 角色选择错误
        case "role_selection_error":
          break;
        // 未知消息类型
        default:
          console.log(`收到消息: ${JSON.stringify(message)}`);
      }
    },
    [
      playerName,
      currentRound,
      currentPhase,
      UI_GAME_PHASES,
      setPlayers,
      setGameState,
      setGameBackground,
      setRoleDefinitions,
      setSelectedRoles,
      setCurrentRound,
      setCurrentPhase,
      setSelectedAction,
      setHasSubmitted,
      setPlayerActions,
      setWaitingForPlayers,
      setRoundEvent,
      setPrivateMessages,
      setTimeLeft,
      setGameResult,
      resetGameState,
    ]
  );

  /**
   * 建立WebSocket连接
   * @param player - 玩家名称
   * @param roomId - 房间ID
   */
  const connectWebSocket = useCallback(
    (player: string, roomId: string): void => {
      console.log(`🔌 步骤开始: 建立WebSocket连接`);
      console.log(`🔌 步骤开始: 参数 - 玩家: ${player}, 房间: ${roomId}`);

      // 步骤1: 参数验证
      console.log(`🔌 步骤1: 开始参数验证`);
      if (!player || !roomId) {
        console.log(
          `🔌 步骤1: 参数验证失败 - 玩家: "${player}", 房间: "${roomId}"`
        );
        return;
      }
      console.log(`🔌 步骤1: 参数验证通过`);

      // 步骤2: 关闭现有连接（如果存在）
      if (wsRef.current) {
        console.log(`🔌 步骤2: 发现现有连接，正在关闭`);
        wsRef.current.close();
        console.log(`🔌 步骤2: 现有连接已关闭`);
      } else {
        console.log(`🔌 步骤2: 无现有连接，跳过关闭步骤`);
      }

      // 步骤3: 构造WebSocket URL并建立新连接
      const wsUrl = `${wsBaseUrl}/ws`;
      console.log(`🔌 步骤3: 构造WebSocket URL: ${wsUrl}`);
      console.log(`🔌 步骤3: 开始建立WebSocket连接`);
      wsRef.current = new WebSocket(wsUrl);
      console.log(`🔌 步骤3: WebSocket对象创建完成，等待连接建立`);

      /**
       * WebSocket连接成功时的处理
       * 发送玩家信息进行房间验证
       */
      wsRef.current.onopen = (): void => {
        console.log(`🔌 步骤4: WebSocket连接成功建立`);

        if (wsRef.current) {
          console.log(`🔌 步骤4.1: 准备发送身份验证信息`);

          // 步骤4.1: 构造身份验证数据
          const authData = {
            player_name: player,
            room_id: roomId,
          };
          console.log(`🔌 步骤4.1: 身份验证数据:`, authData);

          // 步骤4.2: 发送身份验证信息到服务器
          console.log(`🔌 步骤4.2: 发送身份验证信息`);
          wsRef.current.send(JSON.stringify(authData));
          console.log(`🔌 步骤4.2: 身份验证信息发送完成，等待服务器响应`);
        } else {
          console.error(`🔌 步骤4.错误: WebSocket引用丢失`);
        }
      };

      /**
       * 处理WebSocket接收到的消息
       * @param event - WebSocket消息事件
       */
      wsRef.current.onmessage = (event: MessageEvent): void => {
        const message = JSON.parse(event.data) as WebSocketMessage;

        // 处理连接成功消息
        if (message.type === "connection_success") {
          setWsConnected(true);
          setCurrentRoom(roomId);

          // 解构服务器返回的状态数据
          const {
            is_reconnect, // 是否为重新连接
            game_state, // 当前游戏状态
            current_round, // 当前轮次
            players: playersData, // 玩家列表
            selected_roles, // 已选择的角色
            player_actions, // 玩家行动
            game_result, // 游戏结果
            background, // 游戏背景
            dynamic_roles: roles, // 动态角色定义
          } = message.data;

          setPlayers(playersData);

          // 处理重新连接的情况
          if (is_reconnect) {
            // 根据服务器状态恢复游戏状态
            switch (game_state) {
              case "lobby":
                setGameState(GAME_UX_PAGEING.ROOM_LOBBY);
                break;
              case "role_selection":
                setGameState(GAME_UX_PAGEING.ROLE_SELECTION);
                if (selected_roles)
                  setSelectedRoles(selected_roles as string[]);
                if (background) setGameBackground(background as string);
                if (roles)
                  setRoleDefinitions(roles as Record<string, RoleDefinition>);
                break;
              case "loading":
                // 与服务端的通用加载（包括最终结算加载）对齐为 LOADING
                setGameState(GAME_UX_PAGEING.LOADING);
                setCurrentRound((current_round as number) || 1);
                if (background) setGameBackground(background as string);
                break;
              case "playing":
                setGameState(GAME_UX_PAGEING.PLAYING);
                setCurrentRound((current_round as number) || 1);
                if (player_actions)
                  setPlayerActions(player_actions as PlayerAction[]);
                if (background) setGameBackground(background as string);
                if (message.data.roundEvent)
                  setRoundEvent(message.data.roundEvent as RoundEvent);
                if (message.data.privateMessages)
                  setPrivateMessages(
                    message.data.privateMessages as Record<string, string>
                  );
                break;
              case "finished":
                setGameState(GAME_UX_PAGEING.RESULT);
                if (game_result) setGameResult(game_result as GameResult);
                break;
              default:
                setGameState(GAME_UX_PAGEING.ROOM_LOBBY);
            }
          } else {
            // 新连接，进入大厅状态
            setGameState(GAME_UX_PAGEING.ROOM_LOBBY);
          }
        } else {
          // 处理其他类型的消息
          handleWebSocketMessage(message);
        }
      };

      /**
       * WebSocket连接关闭时的处理
       * @param event - 关闭事件
       */
      wsRef.current.onclose = (event: CloseEvent): void => {
        setWsConnected(false);
        // 根据关闭代码显示相应的错误信息
        if (
          event.code === 4004 ||
          event.code === 4000 ||
          event.code === 4001 ||
          event.code === 4005
        ) {
        } else {
        }
      };

      /**
       * WebSocket错误处理
       * @param error - 错误事件
       */
      wsRef.current.onerror = (error: Event): void => {
        console.log(`WebSocket错误: ${error}`);
        setWsConnected(false);
      };
    },
    [
      wsBaseUrl,
      setWsConnected,
      setCurrentRoom,
      setPlayers,
      setGameState,
      setSelectedRoles,
      setGameBackground,
      setRoleDefinitions,
      setCurrentRound,
      setPlayerActions,
      setRoundEvent,
      setPrivateMessages,
      setGameResult,
      handleWebSocketMessage,
    ]
  );

  /**
   * 重新连接到房间
   * 通过用户ID检查是否存在，如果存在则重新连接，否则返回房间选择页面.
   * @param player - 玩家名称
   */
  const reconnectToRoom = useCallback(
    async (player: string): Promise<void> => {
      try {
        // 检查房间状态
        const response = await fetch(`${httpBaseUrl}/rooms/reconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ player_name: player }),
        });
        if (response.ok) {
          const data = await response.json();
          const { room_id } = data;
          console.log(data);

          if (room_id) {
            connectWebSocket(player, room_id);
          } else {
            console.log(`房间 ${room_id} 不存在，返回房间选择页面`);
            setGameState(GAME_UX_PAGEING.ROOM_SELECTION);
          }
        } else {
          setGameState(GAME_UX_PAGEING.ROOM_SELECTION);
        }
      } catch (error) {
        console.log(`重新连接到房间失败: ${error}`);
        setGameState(GAME_UX_PAGEING.ROOM_SELECTION);
      }
    },
    [httpBaseUrl, setGameState, connectWebSocket]
  );

  return {
    wsRef,
    wsConnected: false, // 注意：实际连接状态由外部的 gameState.wsConnected 管理
    connectWebSocket,
    reconnectToRoom,
    handleWebSocketMessage,
  };
}
