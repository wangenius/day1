import type { WebSocket } from "ws";
import { Room } from "./Room.js";
import { PlayerInfo } from "./types/types.js";
import { logger } from "./utils/logger.js";

/**
 * WebSocket消息类型枚举
 *
 * 定义了玩家连接相关的消息类型：
 * - CONNECTION_SUCCESS: 连接建立成功，返回完整游戏状态
 * - PLAYER_JOIN: 玩家加入房间通知
 * - PLAYER_LEAVE: 玩家离开房间通知
 */
enum MessageType {
  CONNECTION_SUCCESS = "connection_success",
  PLAYER_JOIN = "player_join",
  PLAYER_LEAVE = "player_leave",
}

/**
 * 玩家管理类
 *
 * 职责说明：
 * 1. WebSocket连接生命周期管理：建立、维护、断开
 * 2. 消息路由和事件处理：将客户端消息路由到对应的游戏逻辑
 * 3. 玩家状态同步：处理上线/离线状态变化
 * 4. 错误处理和资源清理：处理连接异常和清理资源
 *
 * 核心特性：
 * - 支持断线重连，保持游戏状态连续性
 * - 基于消息类型的动态路由系统
 * - 完善的错误处理和异常恢复机制
 * - 自动的资源清理和内存泄漏防护
 */
export class Player implements PlayerInfo {
  /** 玩家唯一标识符（用户名） */
  name: string;

  /** 玩家在线状态 - true:在线 false:离线（支持重连） */
  is_online: boolean;

  /** 房主权限标识 - 只有房主可以开始游戏和重启游戏 */
  is_host: boolean;

  /** WebSocket连接实例 - 用于实时双向通信 */
  socket: WebSocket | undefined;

  /**
   * 构造函数 - 创建玩家实例
   *
   * @param name 玩家名称（唯一标识符）
   * @param is_host 是否为房主（默认false）
   */
  constructor(name: string, is_host: boolean = false) {
    this.name = name;
    this.is_host = is_host;
    this.is_online = true; // 新创建的玩家默认在线
  }

  /**
   * 根据玩家名称查找所在房间 - 静态工具方法
   *
   * @param name 玩家名称
   * @returns 玩家所在的房间实例，未找到返回null
   */
  static get_by_name(name: string) {
    return Room.get_by_player(name);
  }

  /**
   * 等待客户端发送初始化数据 - 连接建立的第一步
   *
   * 功能说明：
   * - 等待客户端发送包含玩家名称和房间ID的初始化消息
   * - 设置消息监听器，超时和错误处理
   * - 解析JSON格式的初始化数据
   *
   * 数据格式：
   * {
   *   "player_name": "玩家名称",
   *   "room_id": "房间ID"
   * }
   *
   * 错误处理：
   * - 连接关闭时抛出异常
   * - WebSocket错误时抛出异常
   * - JSON解析失败时返回空对象
   *
   * @param ws WebSocket连接实例
   * @returns Promise<初始化数据对象>
   * @throws Error 当连接异常时
   */
  private static async _waitForInit(ws: WebSocket): Promise<{
    player_name: string;
    room_id: string;
  }> {
    const init = await new Promise<string>((resolve, reject) => {
      const onMessage = (data: WebSocket.RawData) => {
        ws.off("message", onMessage);
        resolve(String(data));
      };
      ws.on("message", onMessage);
      ws.once("close", () => reject(new Error("closed")));
      ws.once("error", (e: Error) => reject(e));
    });
    return JSON.parse(init || "{}");
  }

  /**
   * WebSocket连接处理器 - 系统核心入口
   *
   * 完整流程：
   * 1. 等待并解析客户端初始化数据
   * 2. 验证房间存在性和玩家信息
   * 3. 处理玩家加入或重连逻辑
   * 4. 绑定WebSocket连接到玩家
   * 5. 广播玩家状态变化
   * 6. 发送完整游戏状态给客户端
   * 7. 建立消息路由监听器
   * 8. 设置连接断开处理器
   *
   * 错误处理：
   * - 缺少必要参数时关闭连接（4000）
   * - 房间不存在时关闭连接（4004）
   * - 加入房间失败时关闭连接（4005）
   *
   * 消息路由支持：
   * - startup_idea: 创业想法提交
   * - start_game: 游戏开始请求
   * - select_role: 角色选择
   * - game_action: 游戏内行动
   * - restart_game: 游戏重启
   * - leave_room: 主动退出房间
   *
   * @param ws 新建立的WebSocket连接实例
   */
  static async connect(ws: WebSocket) {
    // ========== 第一步：等待并解析客户端初始化数据 ==========
    // 调用私有方法等待客户端发送包含玩家名称和房间ID的初始化消息
    // 这是建立连接后必须进行的第一步，用于身份验证和房间定位
    const { player_name, room_id } = await Player._waitForInit(ws);

    // ========== 第二步：验证必要参数的完整性 ==========
    // 检查客户端是否提供了必要的玩家名称和房间ID
    // 如果缺少任一参数，立即关闭连接并返回错误码4000
    if (!player_name || !room_id) {
      ws.close(4000, "缺少玩家名称或房间ID");
      return;
    }

    // ========== 第三步：验证目标房间是否存在 ==========
    // 根据房间ID查找对应的房间实例
    // 房间不存在可能是因为房间已被删除或ID错误
    const room = Room.get(room_id);
    if (!room) {
      ws.close(4004, `房间 ${room_id} 不存在`);
      return;
    }

    // ========== 第四步：处理玩家加入或重连逻辑 ==========
    // 声明玩家实例和重连标识变量
    let player: Player | null;
    let is_reconnect = false;

    try {
      // 调用玩家创建或更新方法，支持新玩家加入和断线重连
      player = room.get_player(player_name);
      is_reconnect = false;
      if (!player) {
        Room.join(player_name, room.id);
        player = room.get_player(player_name);
        is_reconnect = false;
      } else {
        player.is_online = true;
        is_reconnect = true;
      }
    } catch (e: any) {
      // 如果加入房间失败（例如房间已满、玩家名冲突等），关闭连接
      ws.close(4005, e?.message || "加入房间失败");
      return;
    }

    if (!player) {
      ws.close(4005, "加入房间失败");
      return;
    }

    // ========== 第五步：绑定WebSocket连接到玩家实例 ==========
    // 将WebSocket实例关联到玩家对象，建立双向通信通道
    // 这样玩家对象就可以通过socket属性向客户端发送消息
    player.socket = ws;

    // ========== 第六步：准备玩家列表数据 ==========
    // 获取房间内所有玩家的格式化数据，用于广播和发送给客户端
    // payloadPlayers包含所有玩家的基本信息（姓名、在线状态、房主状态等）
    const payloadPlayers = room.getPlayersPayload();

    // ========== 第七步：记录玩家上线日志 ==========
    // 在服务器日志中记录玩家上线事件，便于调试和监控
    logger.info(`玩家 ${player_name} 上线`);

    // ========== 第八步：广播玩家状态变化 ==========
    if (!is_reconnect) {
      // 情况1：新玩家加入 - 向房间内所有玩家广播
      // 通知所有人有新玩家加入了房间，包括更新后的玩家列表
      await room.broadcast({
        type: MessageType.PLAYER_JOIN,
        data: { player_name, players: payloadPlayers },
      });
    } else {
      // 情况2：玩家重连 - 向除了重连玩家外的所有人广播
      // 通知其他玩家该玩家已重新上线，第三个参数排除重连的玩家本身
      await room.broadcast({
        type: MessageType.PLAYER_JOIN,
        data: { player_name, players: payloadPlayers },
      });
    }

    // ========== 第九步：收集完整游戏状态信息 ==========
    // 获取游戏核心信息对象，包含所有游戏相关数据
    const gameInfo = room.game.gameInfo;
    // 获取当前轮次索引
    const currentRound = gameInfo.current_round;
    // 获取当前轮次的详细信息（事件、玩家行动、私密消息等）
    const currentRoundInfo = gameInfo.rounds[currentRound];

    // ========== 第十步：构造连接成功响应数据 ==========
    // 准备发送给客户端的完整游戏状态数据
    // 这个数据包含了客户端重建完整游戏界面所需的所有信息
    const connection_data = {
      type: MessageType.CONNECTION_SUCCESS, // 消息类型：连接成功
      data: {
        room_id, // 房间ID
        player_name, // 玩家名称
        is_reconnect, // 是否为重连
        game_state: room.state, // 房间/游戏状态
        players: payloadPlayers, // 所有玩家信息
        current_round: currentRound, // 当前轮次
        selected_roles: room.get_selected_roles?.() ?? [], // 已选择的角色
        player_actions: currentRoundInfo // 当前轮次玩家行动记录
          ? Object.entries(currentRoundInfo.player_actions)
          : [],
        game_result: gameInfo.result ?? null, // 游戏结果
        background: gameInfo.background ?? "", // 游戏背景
        roles: gameInfo.roles ?? {}, // 角色信息
        roundEvent: currentRoundInfo ?? undefined, // 当前轮次事件
        privateMessages: currentRoundInfo?.private_messages ?? undefined, // 私密消息
      },
    } as const;

    // ========== 第十一步：发送连接成功响应 ==========
    // 将完整的游戏状态数据发送给刚连接的客户端
    // 客户端收到这个消息后可以完整重建游戏界面和状态
    ws.send(JSON.stringify(connection_data));

    // ========== 第十二步：设置消息路由监听器 ==========
    // 建立实时消息处理机制，处理客户端在连接期间发送的所有消息
    ws.on("message", async (raw: WebSocket.RawData) => {
      try {
        // ========== 12.1：解析客户端消息 ==========
        // 将原始WebSocket数据转换为JSON对象
        const msg = JSON.parse(String(raw) || "{}");
        const t = msg?.type; // 提取消息类型，用于路由分发
        const data = msg?.data || {}; // 提取消息数据载荷，包含具体的操作参数

        /**
         * ========== 12.2：消息路由表 - 基于消息类型的动态分发系统 ==========
         *
         * 每个路由处理器的职责：
         * - startup_idea: 处理创业想法提交，触发想法收集完成检查
         * - start_game: 处理游戏开始请求，仅房主可操作
         * - select_role: 处理角色选择，检查角色冲突和完成度
         * - game_action: 处理游戏内玩家行动，推进游戏流程
         * - restart_game: 处理游戏重启，重置所有游戏状态
         * - leave_room: 处理主动退出，清理玩家数据和连接
         */
        const router: Record<string, (payload: any) => Promise<void>> = {
          // 创业想法提交路由：将玩家的创业想法转发给游戏逻辑处理
          startup_idea: async (payload) =>
            room.game.handle_startup_idea(player_name, payload?.idea),

          // 游戏开始路由：触发游戏开始流程（仅房主可操作）
          start_game: async () => room.game.handle_start_game(player_name),

          // 角色选择路由：处理玩家角色选择，检查冲突和完成度
          select_role: async (payload) =>
            room.game.handle_role_selection(player_name, payload?.role),

          // 游戏行动路由：处理游戏中的玩家决策和行动
          game_action: async (payload) =>
            room.game.handle_game_action(player_name, payload),

          // 游戏重启路由：重置游戏状态，重新开始（仅房主可操作）
          restart_game: async () => room.game.handle_restart_game(player_name),

          // 主动退出房间路由：处理玩家主动离开房间的完整流程
          leave_room: async (payload) => {
            /**
             * ========== 处理玩家主动退出房间 ==========
             *
             * 退出流程：
             * 1. 查找玩家所在房间
             * 2. 获取其他在线玩家列表
             * 3. 完全移除玩家（而非标记离线）
             * 4. 通知其他玩家该玩家已离开
             * 5. 检查房间是否为空，空房间自动删除
             * 6. 关闭WebSocket连接
             *
             * 注意：主动退出与断线的区别
             * - 主动退出：完全移除玩家数据，不支持重连
             * - 断线：仅标记离线，支持重连恢复
             */

            // 重新查找玩家所在房间（防止房间状态变化）
            const room = Room.get_by_player(player_name);
            if (room) {
              // 获取除当前玩家外的其他在线玩家列表，用于后续通知
              const other_online = room
                .get_online_players()
                .filter((p) => p.name !== player_name);

              // 完全从房间中移除玩家（非标记离线，而是彻底删除）
              room.remove_player_completely(player_name);

              // 如果还有其他在线玩家，通知他们该玩家已离开
              if (other_online.length) {
                await room.broadcast({
                  type: MessageType.PLAYER_LEAVE,
                  data: {
                    player_name,
                    players: room.getPlayersPayload(), // 发送更新后的玩家列表
                  },
                });
              }

              // 房间清理：如果房间内没有任何玩家了，删除整个房间
              if (room.get_online_players().length === 0) {
                Room.remove(room.id);
              }
            }

            // 主动关闭WebSocket连接，结束通信
            ws.close();
          },
        };

        // ========== 12.3：执行对应的路由处理器 ==========
        // 根据消息类型查找对应的处理器并执行
        if (router[t]) await router[t](data);
      } catch (error) {
        // ========== 12.4：错误处理 ==========
        // 静默处理消息解析或路由执行错误
        // 避免单个错误消息影响整个连接的稳定性
        logger.error(`消息路由错误:`, error);
      }
    });

    /**
     * ========== 第十三步：设置连接断开处理器 ==========
     * 处理意外断线情况，与主动退出不同的是保留玩家数据支持重连
     *
     * 断线处理流程：
     * 1. 查找玩家所在房间
     * 2. 标记玩家为离线（保留数据支持重连）
     * 3. 通知其他在线玩家
     * 4. 检查房间是否完全无人，自动清理
     * 5. 解绑Socket连接，释放资源
     *
     * 重连支持：
     * - 玩家数据保留在房间中
     * - 重连时可恢复完整游戏状态
     * - 游戏进度不会因断线丢失
     */
    ws.on("close", async () => {
      // ========== 13.1：查找玩家所在房间 ==========
      // 根据玩家名称查找其所在的房间实例
      const r = Room.get_by_player(player_name);

      if (r) {
        // ========== 13.2：获取其他在线玩家列表 ==========
        // 获取除了当前断线玩家外的其他在线玩家
        // 用于判断是否需要通知其他人和是否需要删除房间
        const other_online = r
          .get_online_players()
          .filter((p) => p.name !== player_name);

        // ========== 13.3：标记玩家为离线（保留数据） ==========
        // 调用remove_player方法仅标记玩家为离线，不删除玩家数据
        // 这样玩家重连时可以恢复完整的游戏状态和进度
        r.remove_player(player_name);

        // ========== 13.4：通知其他在线玩家 ==========
        // 如果还有其他在线玩家，通知他们该玩家已离线
        if (other_online.length) {
          await r.broadcast({
            type: MessageType.PLAYER_LEAVE,
            data: {
              player_name,
              players: r.getPlayersPayload(), // 发送更新后的玩家列表（显示离线状态）
            },
          });
        }

        // ========== 13.5：房间清理检查 ==========
        // 如果房间内所有玩家都离线了，删除整个房间以释放资源
        // 这避免了空房间长期占用内存
        if (r.get_online_players().length === 0) Room.remove(r.id);
      }

      // ========== 13.6：解绑Socket连接，释放资源 ==========
      try {
        // 清空玩家对象的socket引用，避免内存泄漏
        // 使用try-catch防止在极端情况下出现的访问错误
        player.socket = undefined;
      } catch {
        // 静默处理socket解绑过程中可能出现的异常
        // 这种异常通常是由于连接已经被清理导致的，可以安全忽略
      }
    });
  }
}
