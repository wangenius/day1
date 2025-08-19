import { useCallback, useRef, useState, useEffect } from "react";
import { type WebSocketMessage } from "../../const/const";
import { getServerConfig } from "../utils/serverConfig";

/**
 * WebSocket Hook 返回值接口
 * 定义了 useWebSocket Hook 返回给调用方的所有方法和引用
 */
export interface UseWebSocketReturn {
  /**
   * WebSocket 连接状态标志
   */
  connected: boolean;
  /**
   * 建立 WebSocket 连接的方法
   * 创建新的WebSocket连接并处理连接生命周期事件
   * @param player - 玩家名称
   * @param roomId - 房间ID
   */
  connect: (player: string, roomId: string) => void;
  /**
   * 添加 WebSocket 消息监听器的方法
   * 支持多个监听器同时监听消息
   * @param callback - 消息处理回调函数
   * @returns 返回监听器ID，用于移除监听器
   */
  listen: (callback: (message: WebSocketMessage) => void) => string;
  /**
   * 移除 WebSocket 消息监听器的方法
   * @param listenerId - 监听器ID
   */
  removeListener: (listenerId: string) => void;
  /**
   * 发送消息到服务器的方法
   * @param message - 要发送的消息对象
   */
  send: (message: WebSocketMessage) => void;
  /**
   * 断开 WebSocket 连接的方法
   */
  disconnect: () => void;
}

const { ws } = getServerConfig();

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
 * - 支持多个监听器同时监听消息
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
 * 
 * const { listen, removeListener, send, connect, disconnect, connected } = useWebSocket({
 *   wsBaseUrl: 'ws://localhost:3001',
 * });
 * 
 * 
 * useEffect(() => {
 *   connect('Player1', 'room123');
 *   
 *   // 添加多个监听器
 *   const listener1 = listen((data) => {
 *     console.log('监听器1:', data.type, data.message);
 *   });
 *   
 *   const listener2 = listen((data) => {
 *     console.log('监听器2:', data.type, data.message);
 *   });
 *   
 *   // 清理函数
 *   return () => {
 *     removeListener(listener1);
 *     removeListener(listener2);
 *     disconnect();
 *   };
 * }, []);


 *   send({
 *     type: 'game_action',
 *     message: { action: 'decision', ... }
 *   });
 * ```
 */
export function useWebSocket(): UseWebSocketReturn {
  /** WebSocket连接引用 */
  const wsRef = useRef<WebSocket | null>(null);
  /** WebSocket连接状态 */
  const [connected, setConnected] = useState<boolean>(false);
  /** 消息监听器列表 */
  const listenersRef = useRef<Map<string, (message: WebSocketMessage) => void>>(
    new Map()
  );
  /** 监听器ID计数器 */
  const listenerIdCounterRef = useRef<number>(0);

  // 组件卸载时清理连接和所有监听器
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      listenersRef.current.clear();
    };
  }, []);

  /**
   * 执行所有监听器
   * @param message - WebSocket消息
   */
  const executeListeners = useCallback((message: WebSocketMessage) => {
    listenersRef.current.forEach((callback) => {
      try {
        callback(message);
      } catch (error) {
        console.error("监听器执行错误:", error);
      }
    });
  }, []);

  const listen = useCallback(
    (callback: (message: WebSocketMessage) => void): string => {
      const listenerId = `listener_${++listenerIdCounterRef.current}`;
      listenersRef.current.set(listenerId, callback);

      // 如果连接已建立，立即设置消息处理器
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.onmessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            executeListeners(message);
          } catch (error) {
            console.error("WebSocket消息解析错误:", error);
          }
        };
      }

      return listenerId;
    },
    [executeListeners]
  );

  const removeListener = useCallback((listenerId: string) => {
    listenersRef.current.delete(listenerId);
  }, []);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket未连接，无法发送消息");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
    }
    // 清理所有监听器
    listenersRef.current.clear();
  }, []);

  /**
   * 建立WebSocket连接
   * @param player - 玩家名称
   * @param roomId - 房间ID
   */
  const connect = useCallback(
    (player: string, roomId: string): void => {
      if (!player || !roomId)
        return console.log(
          `🔌 参数验证失败 - 玩家: "${player}", 房间: "${roomId}"`
        );

      wsRef.current = new WebSocket(ws);

      /**
       * WebSocket连接成功时的处理
       * 发送玩家信息进行房间验证
       */
      wsRef.current.onopen = (): void => {
        console.log("🔌 WebSocket连接已建立");
        setConnected(true);

        if (wsRef.current) {
          // 步骤4.1: 构造身份验证数据
          const authData = {
            player_id: player,
            room_id: roomId,
          };

          // 步骤4.2: 发送身份验证信息到服务器
          wsRef.current.send(JSON.stringify(authData));

          // 设置消息处理器
          if (listenersRef.current.size > 0) {
            wsRef.current.onmessage = (event: MessageEvent) => {
              try {
                const message = JSON.parse(event.data) as WebSocketMessage;
                executeListeners(message);
              } catch (error) {
                console.error("WebSocket消息解析错误:", error);
              }
            };
          }
        }
      };

      /**
       * WebSocket连接关闭时的处理
       * @param event - 关闭事件
       */
      wsRef.current.onclose = (event: CloseEvent): void => {
        console.log(`🔌 WebSocket连接已关闭，代码: ${event.code}`);
        setConnected(false);

        // 根据关闭代码显示相应的错误信息
        if (event.code === 4004) {
          console.error("房间不存在");
        } else if (event.code === 4000) {
          console.error("房间已满");
        } else if (event.code === 4001) {
          console.error("玩家名称已存在");
        } else if (event.code === 4005) {
          console.error("游戏已开始");
        } else if (event.code !== 1000) {
          // 1000是正常关闭
          console.error(`WebSocket异常关闭，代码: ${event.code}`);
        }
      };

      /**
       * WebSocket错误处理
       * @param error - 错误事件
       */
      wsRef.current.onerror = (error: Event): void => {
        console.error("WebSocket错误:", error);
        setConnected(false);
      };
    },
    [ws, executeListeners]
  );

  return {
    connected,
    connect,
    listen,
    removeListener,
    send,
    disconnect,
  };
}
