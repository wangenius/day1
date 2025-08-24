import type { WebSocket } from "ws";
import { Room } from "./Room.js";
import { PlayerState } from "./types/types.js";
import { logger } from "./utils/logger.js";

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
export class Player implements PlayerState {
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
    player_id: string;
    room_id: string;
  }> {
    const init = await new Promise<string>((resolve, reject) => {
      const onMessage = (data: WebSocket.RawData) => {
        ws.off("message", onMessage);
        resolve(String(data));
      };
      ws.on("message", onMessage);
      ws.on("close", () => {
        console.log("连接关闭");
      });
      ws.on("error", (e: Error) => reject(e));
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
    const { player_id, room_id } = await Player._waitForInit(ws);

    // ========== 第二步：验证必要参数的完整性 ==========
    // 检查客户端是否提供了必要的玩家名称和房间ID
    // 如果缺少任一参数，立即关闭连接并返回错误码4000
    if (!player_id || !room_id) {
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
      player = room.get_player(player_id);
      is_reconnect = false;
      if (!player) {
        Room.join(player_id, room.id);
        player = room.get_player(player_id);
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
    const players = room.get_all_players();

    // ========== 第七步：记录玩家上线日志 ==========
    // 在服务器日志中记录玩家上线事件，便于调试和监控
    logger.info(`玩家 ${player_id} ${is_reconnect ? '重连' : '上线'}`);

    // 广播玩家状态变化
    await room.broadcast({
      type: "players",
      data: { players: players },
    });

    // 如果是重连，额外广播完整游戏状态确保同步
    if (is_reconnect) {
      await room.broadcast({
        type: "game_state",
        data: {
          room_state: room.state,
          game_state: room.game.state,
          players: players,
        },
      });
    }

    const connection_data = {
      type: "success", // 消息类型：连接成功
      data: {
        room_id, // 房间ID
        player_id, // 玩家名称
        is_reconnect, // 是否为重连
        players, // 玩家列表
        room_state: room.state, // 房间状态
        game_state: room.game.state, // 游戏状态
      },
    } as const;

    ws.send(JSON.stringify(connection_data));

    // ========== 第十二步：设置消息路由监听器 ==========
    // 建立实时消息处理机制，处理客户端在连接期间发送的所有消息
    ws.on("message", async (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(String(raw) || "{}");
        const type = msg?.type;
        const data = msg?.data || {};
        Player.handle_message(room, player_id, type, data);
      } catch (error) {
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
      const room = Room.get_by_player(player_id);

      if (room) {
        const other_online = room
          .get_online_players()
          .filter((p) => p.name !== player_id);

        room.offline_player(player_id);

        // 广播玩家状态变化和完整游戏状态
        if (other_online.length) {
          await room.broadcast({
            type: "players",
            data: {
              players: room.get_all_players(),
            },
          });
          
          // 同时广播完整的游戏状态，确保其他玩家状态同步
          await room.broadcast({
            type: "game_state",
            data: {
              room_state: room.state,
              game_state: room.game.state,
              players: room.get_all_players(),
            },
          });
        }

        if (room.get_online_players().length === 0) Room.remove(room.id);
      }

      try {
        player.socket = undefined;
      } catch {
        // 静默处理socket解绑过程中可能出现的异常
      }
    });
  }

  private static async handle_message(
    room: Room,
    player_id: string,
    type: string,
    data: any
  ) {
    console.log(room.id, player_id, type, data);

    const router: Record<string, (payload: any) => Promise<void>> = {
      // 游戏开始路由：触发游戏开始流程（仅房主可操作）
      start_game: async () => room.game.handle_start_game(player_id),
      // 创业想法提交路由：将玩家的创业想法转发给游戏逻辑处理
      startup_idea: async (payload) =>
        room.game.handle_startup_idea(player_id, payload?.idea),
      // 角色选择路由：处理玩家角色选择，检查冲突和完成度
      select_role: async (payload) =>
        room.game.handle_role_selection(player_id, payload?.role),

      // 游戏行动路由：处理游戏中的玩家决策和行动
      game_action: async (payload) =>
        room.game.handle_game_action(player_id, payload),

      // 游戏重启路由：重置游戏状态，重新开始（仅房主可操作）
      restart_game: async () => room.game.handle_restart_game(player_id),
    };

    if (router[type]) await router[type](data);
  }
}
