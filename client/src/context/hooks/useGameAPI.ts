import { useCallback } from "react";
import type { RoomInfo } from "../../const/const";

/**
 * 游戏 API Hook 参数接口
 * 定义了 useGameAPI Hook 所需的所有参数
 */
interface UseGameAPIParams {
  /** HTTP API 的基础URL地址，用于构造完整的API请求地址 */
  httpBaseUrl: string;
  /** 当前登录的玩家名称，用于API请求中的身份标识 */
  playerName: string;

  // ========== 状态更新函数 ==========
  /**
   * 设置房间列表的状态更新函数
   * @param rooms - 新的房间信息数组
   */
  setRoomList: (rooms: RoomInfo[]) => void;
  /**
   * 设置房间列表加载状态的函数
   * @param loading - 是否正在加载房间列表
   */
  setLoadingRoomList: (loading: boolean) => void;

  // ========== 工具函数 ==========
  /**
   * 规范化服务器返回的房间数据格式的函数
   * @param rooms - 服务器返回的原始房间数据
   * @returns 规范化后的房间信息数组
   */
  normalizeRoomsPayload: (rooms: any[]) => RoomInfo[];
}

/**
 * 游戏 API Hook 返回值接口
 * 定义了 useGameAPI Hook 返回给调用方的所有方法
 */
interface UseGameAPIReturn {
  /**
   * 获取当前所有在线房间列表的异步方法
   * 会自动更新房间列表状态和加载状态
   * @returns Promise<void> - 异步操作Promise
   */
  fetchRoomList: () => Promise<void>;
  /**
   * 处理房间相关操作（创建或加入房间）的异步方法
   * @param action - 操作类型（当前版本未使用，预留扩展）
   * @param roomId - 目标房间的唯一标识符
   * @returns Promise<void> - 异步操作Promise
   */
  handleRoomAction: (action: string, roomId: string) => Promise<void>;
}

/**
 * 游戏 API 管理 Hook
 *
 * 这个 Hook 封装了与游戏服务器交互的所有 HTTP API 调用功能，
 * 主要负责房间相关的操作，包括获取房间列表和加入/创建房间。
 *
 * @param params - Hook 所需的参数对象
 * @returns 返回 API 操作方法的对象
 *
 * @example
 * ```tsx
 * const { fetchRoomList, handleRoomAction } = useGameAPI({
 *   httpBaseUrl: 'http://localhost:3001',
 *   playerName: 'Player1',
 *   setRoomList,
 *   setLoadingRoomList,
 *   addMessage,
 *   normalizeRoomsPayload,
 * });
 * ```
 */
export function useGameAPI(params: UseGameAPIParams): UseGameAPIReturn {
  const {
    httpBaseUrl,
    playerName,
    setRoomList,
    setLoadingRoomList,
    normalizeRoomsPayload,
  } = params;

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
  const fetchRoomList = useCallback(async (): Promise<void> => {
    // 步骤1: 设置加载状态为true，显示加载指示器
    console.log("📋 步骤1: 开始获取房间列表，设置加载状态");
    setLoadingRoomList(true);

    try {
      // 步骤2: 构造API请求URL并发起GET请求
      const apiUrl = `${httpBaseUrl}/rooms`;
      console.log(`📋 步骤2: 发起房间列表请求到: ${apiUrl}`);
      const response = await fetch(apiUrl);
      console.log(`📋 步骤3: 收到服务器响应，状态码: ${response.status}`);

      // 步骤4: 检查响应状态是否成功
      if (response.ok) {
        console.log("📋 步骤4: 响应成功，开始解析数据");

        // 步骤5: 解析JSON响应数据
        const data: { rooms: RoomInfo[] } = await response.json();
        console.log("📋 步骤5: 成功解析响应数据:", data);

        // 步骤6: 规范化房间数据格式
        console.log("📋 步骤6: 开始规范化房间数据格式");
        const normalizedRooms = normalizeRoomsPayload(data.rooms);
        console.log(
          `📋 步骤6: 规范化完成，共 ${normalizedRooms.length} 个房间`
        );

        // 步骤7: 更新房间列表状态
        console.log("📋 步骤7: 更新房间列表状态");
        setRoomList(normalizedRooms);

        // 步骤8: 显示成功消息给用户
        console.log("📋 步骤8: 显示成功消息");
        console.log(
          `📋 完成: 房间列表更新完成，共 ${normalizedRooms.length} 个房间`
        );
      } else {
        // 步骤4.1: 处理HTTP错误响应
        console.log("📋 步骤4.1: 响应失败，开始处理错误");

        // 步骤4.2: 获取错误详情
        const errorText = await response.text();
        console.error(
          `📋 步骤4.2: 获取房间列表失败，状态码: ${response.status}, 错误详情:`,
          errorText
        );

        // 步骤4.3: 显示错误消息
        console.log("📋 步骤4.3: 显示错误消息给用户");

        // 步骤4.4: 清空房间列表
        console.log("📋 步骤4.4: 清空房间列表");
        setRoomList([]);
      }
    } catch (error) {
      // 异常处理: 网络错误或其他异常
      console.log("📋 异常处理: 捕获到网络错误或其他异常");
      console.error("📋 异常详情:", error);
      setRoomList([]);
    } finally {
      // 最终步骤: 无论成功失败都要重置加载状态
      console.log("📋 最终步骤: 重置加载状态为false");
      setLoadingRoomList(false);
    }
  }, [httpBaseUrl, setLoadingRoomList, normalizeRoomsPayload, setRoomList]);

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
   * @param _action - 操作类型（预留参数，当前版本未使用）
   * @param roomId - 目标房间的唯一标识符
   * @throws {Error} 当加入房间失败时抛出异常，包含具体的错误信息
   *
   * @example
   * ```tsx
   * try {
   *   await handleRoomAction('join', 'room123');
   *   // 成功后建立WebSocket连接
   *   connectWebSocket(playerName, 'room123');
   * } catch (error) {
   *   // 处理错误
   *   console.error('加入房间失败:', error);
   * }
   * ```
   */
  const handleRoomAction = useCallback(
    async (_action: string, roomId: string): Promise<void> => {
      try {
        // 步骤1: 构造API请求URL和显示开始消息
        const apiUrl = `${httpBaseUrl}/rooms/join`;
        console.log(`🚪 步骤1: 开始加入房间操作，目标房间: ${roomId}`);
        console.log(`🚪 步骤1: API地址: ${apiUrl}`);

        // 步骤2: 构造请求参数
        const requestBody = {
          room_id: roomId,
          player_id: playerName,
        };
        console.log(`🚪 步骤2: 构造请求参数:`, requestBody);

        // 步骤3: 构造请求配置
        const requestConfig = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        };
        console.log(`🚪 步骤3: 构造请求配置，方法: ${requestConfig.method}`);

        // 步骤4: 发送HTTP POST请求到服务器
        console.log(`🚪 步骤4: 发送加入房间请求到服务器`);
        const response = await fetch(apiUrl, requestConfig);
        console.log(`🚪 步骤5: 收到服务器响应，状态码: ${response.status}`);

        // 步骤6: 解析服务器响应数据
        console.log(`🚪 步骤6: 开始解析响应数据`);
        const data = (await response.json()) as {
          success: boolean;
          message?: string;
        };
        console.log(`🚪 步骤6: 解析完成，响应数据:`, data);

        // 步骤7: 检查操作是否成功
        if (data.success) {
          console.log(`🚪 步骤7: 房间操作成功`);

          // 步骤7.1: 显示成功消息
          console.log(`🚪 步骤7.1: 显示成功消息给用户`);

          // 步骤7.2: 成功完成，返回让调用者处理后续逻辑（如WebSocket连接）
          console.log(
            `🚪 步骤7.2: 房间加入完成，返回给调用者处理WebSocket连接`
          );
          return;
        } else {
          // 步骤7.alt: 处理服务器返回的业务失败
          console.log(`🚪 步骤7.alt: 房间操作失败，服务器返回:`, data.message);

          // 步骤7.alt.1: 显示失败消息
          const errorMessage = data.message || "进入房间失败";
          console.log(`🚪 步骤7.alt.1: 显示失败消息: ${errorMessage}`);

          // 步骤7.alt.2: 抛出错误，让调用者知道操作失败
          console.log(`🚪 步骤7.alt.2: 抛出错误给调用者`);
          throw new Error(errorMessage);
        }
      } catch (error) {
        // 异常处理: 网络错误、解析错误或业务错误
        console.log(`🚪 异常处理: 捕获到异常`, error);

        // 异常处理步骤1: 格式化错误消息
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log(`🚪 异常处理步骤1: 格式化错误消息: ${errorMessage}`);

        // 异常处理步骤2: 显示错误消息给用户
        console.log(`🚪 异常处理步骤2: 显示错误消息给用户`);

        // 异常处理步骤3: 重新抛出错误让调用者处理
        console.log(`🚪 异常处理步骤3: 重新抛出错误给调用者处理`);
        throw error;
      }
    },
    [httpBaseUrl, playerName]
  );

  return {
    fetchRoomList,
    handleRoomAction,
  };
}
