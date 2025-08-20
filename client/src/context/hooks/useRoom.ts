import { useCallback, useEffect, useState } from "react";
import type { RoomInfo } from "../../const/const";
import { getServerConfig } from "../utils/serverConfig";
import { UseWebSocketReturn } from "./useWebSocket";

/**
 * 游戏 API Hook 参数接口
 * 定义了 useGameAPI Hook 所需的所有参数
 */
export interface UseRoomParams {
  webSocket: UseWebSocketReturn;
}

export type RoomState =
  | "landing_page"
  | "username"
  | "entrance"
  | "waiting"
  | "playing";

/**
 * 游戏 API Hook 返回值接口
 * 定义了 useGameAPI Hook 返回给调用方的所有方法
 */
export interface UseRoomReturn {
  player: string;
  state: RoomInfo;
  roomList: RoomInfo[];
  loadingRoomList: boolean;
  roomState: RoomState;
  setPlayer: (name: string) => void;
  /**
   * 获取当前所有在线房间列表的异步方法
   * 会自动更新房间列表状态和加载状态
   * @returns Promise<void> - 异步操作Promise
   */
  list: () => Promise<void>;
  /**
   * 处理房间相关操作（创建或加入房间）的异步方法
   * @param roomId - 目标房间的唯一标识符
   * @returns Promise<void> - 异步操作Promise
   */
  join: (roomId: string) => Promise<void>;
  /**
   * 处理房间相关操作（创建或加入房间）的异步方法
   * @returns Promise<void> - 异步操作Promise
   */
  leave: () => Promise<void>;
  /**
   * 重新连接到房间
   * @param player - 玩家名称
   * @returns Promise<void> - 异步操作Promise
   */
  reconnect: (player: string) => Promise<void>;
  /**
   * 更新房间状态
   * @param room - 房间信息
   */
  update: (room: RoomInfo) => void;
  /**
   * 设置房间状态
   * @param state - 房间状态
   */
  setRoomState: (state: RoomState) => void;

  /**
   * 开始游戏
   */
  startGame: () => void;
}

const { http } = getServerConfig();

/**
 * 游戏 API 管理 Hook
 *
 * 主要负责房间相关的操作，包括获取房间列表和加入/创建房间。
 *
 * @param params - Hook 所需的参数对象
 * @returns 返回 API 操作方法的对象
 */
export function useRoom(params: UseRoomParams): UseRoomReturn {
  const { webSocket } = params;

  const [roomList, setRoomList] = useState<RoomInfo[]>([]);
  const [state, setState] = useState<RoomInfo>({
    id: "",
    state: "waiting",
    players: [],
  });
  const [loadingRoomList, setLoadingRoomList] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<RoomState>("landing_page");
  /** 当前玩家名称 */
  const [player, setPlayer] = useState<string>("");

  /**
   * 获取房间列表
   * @throws {Error} 当网络请求失败或服务器返回错误时抛出异常
   */
  const list = useCallback(async (): Promise<void> => {
    setLoadingRoomList(true);

    try {
      const apiUrl = `${http}/rooms`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data: { rooms: RoomInfo[] } = await response.json();
        setRoomList(data.rooms);
      } else {
        const errorText = await response.text();
        console.error(
          `获取房间列表失败，状态码: ${response.status}, 错误详情:`,
          errorText
        );
        setRoomList([]);
      }
    } catch (error) {
      console.error("获取房间列表失败:", error);
      setRoomList([]);
    } finally {
      setLoadingRoomList(false);
    }
  }, [http, setLoadingRoomList, setRoomList]);

  /**
   * 处理房间操作（创建或加入房间）
   */
  const join = useCallback(
    async (roomId: string): Promise<void> => {
      try {
        const apiUrl = `${http}/rooms/join`;

        // 步骤3: 构造请求配置
        const requestConfig = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: roomId,
            player_id: player,
          }),
        };
        console.log(requestConfig);

        // 步骤4: 发送HTTP POST请求到服务器
        const response = await fetch(apiUrl, requestConfig);
        console.log(response);

        const data = (await response.json()) as {
          success: boolean;
          message?: string;
        };

        webSocket.connect(player, roomId);

        // 步骤7: 检查操作是否成功
        if (data.success) {
          setRoomState("waiting");
          return;
        } else {
          const errorMessage = data.message || "进入房间失败";
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.log(error);
        throw error;
      }
    },
    [http, player]
  );

  const leave = useCallback(async (): Promise<void> => {
    try {
      const apiUrl = `${http}/rooms/leave`;
      const requestBody = {
        room_id: state?.id,
        player_id: player,
      };

      const requestConfig = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      };

      const response = await fetch(apiUrl, requestConfig);

      const data = (await response.json()) as {
        success: boolean;
        message?: string;
      };

      if (data.success) {
        setRoomState("entrance");
        return;
      } else {
        const errorMessage = data.message || "离开房间失败";
        throw new Error(errorMessage);
      }
    } catch (error) {
      throw error;
    }
  }, [http, player]);

  /**
   * 重新连接到房间
   * 通过用户ID检查是否存在，如果存在则重新连接，否则返回房间选择页面.
   * @param player - 玩家名称
   */
  const reconnect = useCallback(
    async (player: string): Promise<void> => {
      try {
        // 检查房间状态
        const response = await fetch(`${http}/rooms/reconnect`, {
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
            webSocket.connect(player, room_id);
          } else {
            console.log(`房间 ${room_id} 不存在，返回房间选择页面`);
            setRoomState("entrance");
          }
        } else {
          setRoomState("entrance");
        }
      } catch (error) {
        console.log(`重新连接到房间失败: ${error}`);
        setRoomState("entrance");
      }
    },
    [http, setRoomState]
  );

  const update = useCallback(
    (room: RoomInfo) => {
      setState(room);
    },
    [setState]
  );

  const playerSet = useCallback(
    (name: string) => {
      setPlayer(name);
      localStorage.setItem("startup_player_name", name);
    },
    [setPlayer]
  );

  const startGame = useCallback(() => {
    if (!state) {
      return;
    }
    webSocket.send({
      type: "start_game",
      data: {
        room_id: state.id,
        player_id: player,
      },
    });
  }, [webSocket]);

  /**
   * 从localStorage 加载玩家名称, 并请求重新连接
   */
  useEffect(() => {
    const savedPlayerName = localStorage.getItem("startup_player_name");
    if (savedPlayerName) {
      setPlayer(savedPlayerName);
      reconnect(savedPlayerName);
    }
  }, [reconnect]);

  useEffect(() => {
    if (webSocket.connected) {
      webSocket.listen((message) => {
        if (message.type === "success") {
          const data = message.data as {
            room_id: string;
            player_id: string;
            is_reconnect: boolean;
            players: any[];
            room_state: "waiting" | "playing";
            game_state: any;
          };
          if (data.room_state === "waiting") {
            setRoomState("waiting");
          } else {
            setRoomState("playing");
          }
          setState({
            id: data.room_id,
            state: data.room_state as "waiting" | "playing",
            players: data.players,
          });
        }
        if (message.type === "players") {
          const data = message.data as {
            players: any[];
          };
          setState((prev) => {
            if (prev) {
              return { ...prev, players: data.players };
            }
            return prev;
          });
        }
      });
    }
  }, [webSocket.connected]);

  return {
    player,
    state,
    roomList,
    loadingRoomList,
    roomState,
    setPlayer: playerSet,
    list,
    join,
    leave,
    reconnect,
    update,
    setRoomState,
    startGame,
  };
}
