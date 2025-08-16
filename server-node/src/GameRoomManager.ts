import { GameRoom } from "./GameRoom.js";

/**
 * 房间管理器
 * 1. 创建房间
 * 2. 获取房间
 * 3. 加入房间
 * 4. 移除房间
 * 5. 获取所有房间
 * 6. 获取房间数量
 * 7. 清理空房间
 */
export class RoomManager {
  private rooms: Record<string, GameRoom> = {};

  create_room(room_id: string) {
    if (Object.keys(this.rooms).length >= 10)
      throw new Error("房间数量已满，请耐心排队");
    if (this.rooms[room_id]) throw new Error(`房间 ${room_id} 已存在`);
    const room = new GameRoom(room_id, new Date());
    this.rooms[room_id] = room;
    return room;
  }

  get_room(room_id: string) {
    return this.rooms[room_id] || null;
  }

  join_room(player_name: string, room_id: string) {
    const room = this.get_room(room_id);
    if (!room) throw new Error(`房间 ${room_id} 不存在`);
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

  remove_room(room_id: string) {
    const ok = delete this.rooms[room_id];
    return ok;
  }

  get_all_rooms() {
    return this.rooms;
  }

  get_room_count() {
    return Object.keys(this.rooms).length;
  }

  cleanup_empty_rooms() {
    for (const room_id in this.rooms) {
      const room = this.rooms[room_id];
      if (room.get_online_players().length === 0) {
        this.remove_room(room_id);
      }
    }
  }

  /**
   * 根据玩家名称查找其所在的房间
   */
  find_room_by_player(player_name: string) {
    for (const room of Object.values(this.rooms)) {
      const p = room.get_player(player_name);
      if (p) return room;
    }
    return null;
  }
}

export const room_manager = new RoomManager();
