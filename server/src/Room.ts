import { Game } from "./Game.js";
import { Player } from "./Player.js";

export enum RoomState {
  LOBBY = "lobby",
  PLAYING = "playing",
  FINISHED = "finished",
}

/**
 * 游戏房间
 * 1. 房间ID
 * 2. 玩家列表
 * 3. 创业想法
 * 4. 创建时间
 */
export class Room {
  // 房间列表
  private static rooms: Record<string, Room> = {};
  // 房间ID
  id: string;
  // 玩家列表
  players: Player[] = [];
  // 创建时间
  created_at: Date;
  // 房间状态
  state: RoomState = RoomState.LOBBY;
  // 游戏
  game: Game;

  constructor(room_id: string, created_at: Date) {
    this.id = room_id;
    this.created_at = created_at;
    this.game = new Game();
  }

  /**
   * 给指定玩家发送消息（若该玩家在线且有 socket）
   */
  async send_to_player(player_name: string, message: any) {
    const p = this.get_player(player_name) as any;
    const ws = p?.socket as any;
    if (!ws || ws.readyState !== ws?.OPEN) return;
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // ignore
    }
  }

  /**
   * 向房间内在线玩家广播消息
   */
  async broadcast(message: any, exclude_player?: string) {
    let sent = 0;
    for (const p of this.players as any[]) {
      if (!p.is_online) continue;
      if (exclude_player && p.name === exclude_player) continue;
      const ws = p?.socket as any;
      if (!ws || ws.readyState !== ws?.OPEN) continue;
      await this.send_to_player(p.name, message);
      sent++;
    }
    return sent;
  }

  /**
   * 添加玩家
   * @param player 玩家
   * @returns 是否成功
   */
  add_player(player: Player) {
    if (this.state !== RoomState.LOBBY)
      throw new Error("游戏已开始，无法加入房间");
    const existing = this.get_player(player.name);
    if (existing) {
      existing.is_online = true;
      return true;
    }
    if (this.get_online_players().length >= 4)
      throw new Error("房间已满，最多4人");
    if (this.players.length === 0) player.is_host = true;
    this.players.push(player);
    return true;
  }

  /**
   * 移除玩家
   * @param player_name 玩家名称
   * @returns 是否成功
   */
  remove_player(player_name: string) {
    const p = this.get_player(player_name);
    if (p) p.is_online = false;
    return true;
  }

  get_player(player_name: string) {
    return this.players.find((p) => p.name === player_name) || null;
  }

  /**
   * 获取在线玩家
   * @returns 在线玩家列表
   */
  get_online_players() {
    return this.players.filter((p) => p.is_online);
  }

  /**
   * 创建房间
   * @param id 房间ID
   * @returns 房间
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
   * @param player_name 玩家名称
   * @param id 房间ID
   * @returns 房间
   */
  static join(player_name: string, id: string) {
    const room = this.get(id);
    if (!room) throw new Error(`房间 ${id} 不存在`);
    const player = {
      name: player_name,
      is_online: true,
      joined_at: new Date().toISOString(),
      role: null as any,
      startup_idea: null as any,
      is_host: false,
      actions: [],
    };
    room.add_player(player);
    return room;
  }

  /**
   * 移除房间
   * @param room_id 房间ID
   * @returns 是否成功
   */
  static remove(room_id: string) {
    const ok = delete this.rooms[room_id];
    return ok;
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
   * 清理空房间
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
}
