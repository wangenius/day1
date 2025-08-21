import { Game } from "./Game.js";
import { Player } from "./Player.js";
import { RoomStatus, RoleEnum, PlayerState, GameState } from "./types/types.js";
import { logger } from "./utils/logger.js";

/**
 * 游戏房间管理类
 *
 * 职责说明：
 * 1. 房间生命周期管理：创建、销毁、清理空房间
 * 2. 玩家连接管理：处理玩家加入、离开、重连
 * 3. 消息通信：WebSocket消息广播和单点发送
 * 4. 游戏状态检查：验证游戏开始条件（创业想法、角色选择）
 *
 * 设计模式：
 * - 工厂模式：通过静态方法创建和管理房间实例
 * - 单例管理：通过静态字典确保房间ID唯一性
 * - 观察者模式：消息广播机制向所有玩家同步状态
 */
export class Room {
  /** 全局房间存储字典 - 静态管理所有房间实例，最多支持10个房间 */
  private static rooms: Record<string, Room> = {};

  /** 房间唯一标识符 */
  id: string;

  /** 房间内玩家列表 - 包含在线和离线玩家，最多4人 */
  players: Map<string, Player> = new Map();

  /** 房间创建时间戳 */
  created_at: Date;

  /** 房间当前状态 - PREPARE(准备阶段) | PLAYING(游戏进行中) */
  state: RoomStatus = RoomStatus.WAITING;

  /** 当前房间关联的游戏实例 - 处理所有游戏逻辑 */
  game: Game;

  /**
   * 构造函数 - 初始化房间实例
   * @param room_id 房间唯一标识符
   * @param created_at 房间创建时间
   */
  constructor(room_id: string, created_at: Date) {
    this.id = room_id;
    this.created_at = created_at;
    this.game = new Game(this); // 创建关联的游戏实例
  }

  /**
   * 构建玩家列表数据载荷 - 用于客户端展示
   *
   * 功能说明：
   * - 根据游戏阶段按需包含角色和创业想法信息
   * - 始终包含基础信息：姓名、在线状态、房主标识
   * - 支持灵活的数据组合，避免敏感信息泄露
   *
   * @param options 可选参数配置
   * @param options.includeRole 是否包含角色信息
   * @param options.includeIdea 是否包含创业想法信息
   * @returns 格式化的玩家信息数组
   */
  get_all_players() {
    return Array.from(this.players.values()).map((p) => {
      const base: any = {
        name: p.name,
        is_online: p.is_online,
        is_host: p.is_host,
      };
      return base;
    });
  }

  /**
   * 向指定玩家发送私密消息
   *
   * 功能说明：
   * - 检查玩家是否存在且在线
   * - 验证WebSocket连接状态
   * - 安全发送消息，失败时静默处理
   *
   * 使用场景：
   * - 发送角色私密信息
   * - 错误提示消息
   * - 个人状态更新
   *
   * @param player_name 目标玩家名称
   * @param message 要发送的消息对象
   */
  async send_to_player(player_name: string, message: any) {
    const p = this.get_player(player_name);
    const ws = p?.socket;
    if (!ws || ws.readyState !== ws.OPEN) return;
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // ignore
    }
  }

  /**
   * 向房间内所有在线玩家广播消息
   *
   * 功能说明：
   * - 遍历所有在线玩家并发送消息
   * - 支持排除特定玩家（如发送者本人）
   * - 自动跳过离线或连接异常的玩家
   * - 返回实际发送成功的玩家数量
   *
   * 使用场景：
   * - 游戏状态同步
   * - 玩家加入/离开通知
   * - 轮次事件广播
   * - 游戏结果公布
   *
   * @param message 要广播的消息对象
   * @returns 成功发送消息的玩家数量
   */
  async broadcast(message: {
    type: "players" | "game_state";
    data: {
      room_id?: string;
      player_id?: string;
      players?: PlayerState[];
      game_state?: GameState;
      room_state?: RoomStatus;
    };
  }) {
    let sent = 0;
    for (const p of Array.from(this.players.values())) {
      if (!p.is_online) continue;
      const ws = p?.socket;
      if (!ws || ws.readyState !== ws.OPEN) continue;
      await this.send_to_player(p.name, message);
      sent++;
    }
    return sent;
  }

  /**
   * 添加玩家到房间
   *
   * 功能说明：
   * - 检查房间状态，只有准备阶段才能加入
   * - 处理玩家重连情况（已存在则标记为在线）
   * - 检查房间人数限制（最多4人）
   * - 自动设置第一个玩家为房主
   *
   * 错误处理：
   * - 游戏已开始时抛出异常
   * - 房间已满时抛出异常
   *
   * @param player 要添加的玩家实例
   * @returns 是否成功添加
   * @throws Error 当游戏已开始或房间已满时
   */
  add_player(player: Player) {
    if (this.state !== RoomStatus.WAITING)
      throw new Error("游戏已开始，无法加入房间");
    const existing = this.get_player(player.name);
    if (existing) {
      existing.is_online = true;
      return true;
    }
    if (this.get_online_players().length >= 4)
      throw new Error("房间已满，最多4人");
    if (this.players.size === 0) player.is_host = true;
    this.players.set(player.name, player);
    logger.info(`玩家 ${player.name} 加入房间`);
    logger.info("当前玩家:", this.get_online_players());
    return true;
  }

  /**
   * 移除玩家（标记为离线）
   * @param player_name 玩家名称
   * @returns 是否成功
   */
  offline_player(player_name: string) {
    const p = this.get_player(player_name);
    if (p) p.is_online = false;
    logger.info(`玩家 ${player_name} 离线`);
    logger.info("当前玩家:", this.get_online_players());
    return true;
  }

  /**
   * 完全移除玩家（从玩家列表中删除）
   * @param player_name 玩家名称
   * @returns 是否成功
   */
  remove_player(player_name: string) {
    this.players.delete(player_name);
    logger.info(`玩家 ${player_name} 离开房间`);
    logger.info("当前玩家:", this.get_online_players());
    return true;
  }

  get_player(player_name: string) {
    return this.players.get(player_name) || null;
  }

  /**
   * 获取在线玩家
   * @returns 在线玩家列表
   */
  get_online_players() {
    return Array.from(this.players.values()).filter((p) => p.is_online);
  }

  /**
   * 创建新房间 - 工厂方法
   *
   * 功能说明：
   * - 检查全局房间数量限制（最多10个）
   * - 验证房间ID唯一性
   * - 创建房间实例并注册到全局字典
   *
   * 限制说明：
   * - 最多同时存在10个房间，防止资源耗尽
   * - 房间ID必须唯一，避免冲突
   *
   * @param id 房间唯一标识符
   * @returns 新创建的房间实例
   * @throws Error 当房间数量已满或房间ID已存在时
   */
  static create(id: string) {
    if (Object.keys(this.rooms).length >= 10)
      throw new Error("房间数量已满，请耐心排队");
    if (this.rooms[id]) throw new Error(`房间 ${id} 已存在`);
    const room = new Room(id, new Date());
    this.rooms[id] = room;
    return room;
  }

  /**
   * 获取房间
   * @param room_id 房间ID
   * @returns 房间
   */
  static get(id: string) {
    return this.rooms[id] || null;
  }

  /**
   * 加入房间
   * @param player_id 玩家名称
   * @param id 房间ID
   * @returns 房间
   */
  static join(player_id: string, id: string) {
    const room = this.get(id);
    if (!room) throw new Error(`房间 ${id} 不存在`);
    const player = new Player(player_id, false);
    room.add_player(player);
    return room;
  }

  /**
   * 移除房间
   * @param room_id 房间ID
   * @returns 是否成功
   */
  static remove(room_id: string) {
    const room = this.get(room_id);
    if (!room) return false;
    try {
      room.game.cleanupRoom();
    } catch {}
    return delete this.rooms[room_id];
  }

  /**
   * 获取所有房间
   * @returns 房间列表
   */
  static get_all() {
    return this.rooms;
  }

  /**
   * 获取房间数量
   * @returns 房间数量
   */
  static total_count() {
    return Object.keys(this.rooms).length;
  }

  /**
   * 清理空房间 - 系统维护方法
   *
   * 功能说明：
   * - 遍历所有房间，找出无在线玩家的房间
   * - 自动删除空房间，释放系统资源
   * - 清理关联的游戏实例和定时器
   *
   * 调用时机：
   * - 玩家断开连接后
   * - 系统定期维护任务
   * - 服务器资源清理
   *
   * 注意事项：
   * - 只删除完全无人的房间
   * - 保留有离线玩家的房间（支持重连）
   */
  static cleanup() {
    for (const room_id in this.rooms) {
      const room = this.rooms[room_id];
      if (room.get_online_players().length === 0) {
        this.remove(room_id);
      }
    }
  }

  /**
   * 根据玩家名称查找其所在的房间
   */
  static get_by_player(player_name: string) {
    for (const room of Object.values(this.rooms)) {
      const p = room.get_player(player_name);
      if (p) return room;
    }
    return null;
  }

  /**
   * 检查是否所有玩家都已提交创业想法
   *
   * 功能说明：
   * - 遍历房间内所有玩家
   * - 检查每个玩家是否都提交了创业想法
   * - 用于判断是否可以进入角色选择阶段
   *
   * 判断逻辑：
   * - 必须所有玩家都有对应的创业想法记录
   * - 空字符串或undefined视为未提交
   *
   * @returns 是否所有玩家都已提交创业想法
   */
  all_players_have_ideas() {
    const ideas = this.game.state.ideas;
    const players = Array.from(this.players.keys());
    return players.every((player) => ideas[player]);
  }

  /**
   * 检查是否所有玩家都已选择角色
   *
   * 功能说明：
   * - 遍历房间内所有玩家
   * - 检查每个玩家是否都选择了角色
   * - 用于判断是否可以开始游戏
   *
   * 角色要求：
   * - 必须选择四个不同角色：CEO、CTO、CMO、COO
   * - 每个角色只能被一个玩家选择
   * - 所有玩家必须都完成角色选择
   *
   * @returns 是否所有玩家都已选择角色
   */
  all_players_have_roles() {
    const roles = this.game.state.roles;
    const players = Array.from(this.players.keys());
    return players.every((player) => roles[player]);
  }

  /**
   * 已被选中的角色列表
   */
  get_selected_roles() {
    const roles = this.game.state.roles;
    const players = Array.from(this.players.keys());
    return players.map((player) => roles[player]);
  }
}
