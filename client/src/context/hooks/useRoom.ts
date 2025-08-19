import { useCallback, useEffect, useState } from "react";
import type { RoomInfo } from "../../const/const";
import { getServerConfig } from "../utils/serverConfig";

/**
 * 游戏 API Hook 参数接口
 * 定义了 useGameAPI Hook 所需的所有参数
 */
export interface UseRoomParams {
  /** 建立 WebSocket 连接的方法 */
  connectWebSocket: (player: string, roomId: string) => void;
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
  room: RoomInfo | null;
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
  const { connectWebSocket } = params;

  const [roomList, setRoomList] = useState<RoomInfo[]>([]);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [loadingRoomList, setLoadingRoomList] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<RoomState>("landing_page");
  /** 当前玩家名称 */
  const [player, setPlayer] = useState<string>("");

  /**
   * 获取房间列表
   *
   * 向服务器发起 GET 请求获取当前所有在线房间的信息，
   * 包括房间ID、玩家数量、游戏状态等。会自动处理加载状态、
   * 错误处理和数据格式转换。
   *
   * 执行流程：
   * 1. 设置加载状态为 true
   * 2. 发起 HTTP GET 请求到 /rooms 接口
   * 3. 解析响应数据并规范化格式
   * 4. 更新房间列表状态
   * 5. 显示操作结果消息
   * 6. 重置加载状态
   *
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
   *
   * 向服务器发送加入房间的请求。当前版本主要处理加入房间的场景，
   * 创建房间逻辑在后端自动处理（房间不存在时自动创建）。
   *
   * 执行流程：
   * 1. 构造请求参数（房间ID和玩家ID）
   * 2. 发送 POST 请求到 /rooms/join 接口
   * 3. 处理服务器响应
   * 4. 根据成功/失败状态显示相应消息
   * 5. 成功时交由调用方处理后续逻辑（如建立WebSocket连接）
   *
   * @param roomId - 目标房间的唯一标识符
   * @throws {Error} 当加入房间失败时抛出异常，包含具体的错误信息
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

        connectWebSocket;

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
        room_id: room?.id,
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
            connectWebSocket(player, room_id);
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
      setRoom(room);
    },
    [setRoom]
  );

  const playerSet = useCallback(
    (name: string) => {
      setPlayer(name);
      localStorage.setItem("startup_player_name", name);
    },
    [setPlayer]
  );

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

  return {
    player,
    room,
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
  };
}
