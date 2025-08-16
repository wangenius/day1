import type { WebSocket } from "ws";
import { MessageType } from "./types/types.js";
import { Room } from "./Room.js";

export class Player {
  // 玩家名称
  name: string = "";
  // 是否在线
  is_online: boolean = true;
  // 是否为房主
  is_host: boolean = false;
  // 加入时间
  joined_at: string = new Date().toISOString();
  // 连接
  socket?: WebSocket;

  // 构造函数
  constructor(name: string, is_host: boolean) {
    this.name = name;
    this.is_host = is_host;
  }

  static get_by_name(name: string) {
    return Room.get_by_player(name);
  }

  /**
   * 用户链接
   */
  static async connect(ws: WebSocket) {
    // 等待首条连接信息
    const init = await new Promise<string>((resolve, reject) => {
      const onMessage = (data: WebSocket.RawData) => {
        ws.off("message", onMessage);
        resolve(String(data));
      };
      ws.on("message", onMessage);
      ws.once("close", () => reject(new Error("closed")));
      ws.once("error", (e: Error) => reject(e));
    });
    const { player_name, room_id } = JSON.parse(init || "{}");
    if (!player_name || !room_id) {
      ws.close(4000, "缺少玩家名称或房间ID");
      return;
    }
    const room = Room.get(room_id);
    if (!room) {
      ws.close(4004, `房间 ${room_id} 不存在`);
      return;
    }
    let player = room.get_player(player_name);
    let is_reconnect = false;
    if (!player) {
      try {
        Room.join(player_name, room_id);
        player = room.get_player(player_name);
        is_reconnect = false;
      } catch (e: any) {
        ws.close(4005, e?.message || "加入房间失败");
        return;
      }
    } else {
      player.is_online = true;
      is_reconnect = true;
    }
    // 绑定 socket 到 player
    (player as any).socket = ws;

    const payloadPlayers = room.players.map((p) => ({
      name: p.name,
      is_online: p.is_online,
      isHost: p.is_host,
    }));

    if (!is_reconnect) {
      await room.broadcast({
        type: MessageType.PLAYER_JOIN,
        data: { player_name, players: payloadPlayers },
      });
    } else {
      await room.broadcast(
        {
          type: MessageType.PLAYER_JOIN,
          data: { player_name, players: payloadPlayers },
        },
        player_name
      );
    }

    const connection_data = {
      type: MessageType.CONNECTION_SUCCESS,
      data: {
        room_id,
        player_name,
        is_reconnect,
        game_state: room.state,
        players: payloadPlayers,
      },
    } as const;

    ws.send(JSON.stringify(connection_data));

    ws.on("message", async (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(String(raw) || "{}");
        const t = msg?.type;
        const game = room.game;
        const data = msg?.data || {};
        if (t === "startup_idea")
          await game.handle_startup_idea(player_name, data?.idea);
        else if (t === "start_game") await game.handle_start_game(player_name);
        else if (t === "select_role")
          await game.handle_role_selection(player_name, data?.role);
        else if (t === "game_action")
          await game.handle_game_action(player_name, data);
        else if (t === "restart_game")
          await game.handle_restart_game(player_name);
      } catch {}
    });

    ws.on("close", async () => {
      const r = Room.get_by_player(player_name);
      if (r) {
        const other_online = r
          .get_online_players()
          .filter((p) => p.name !== player_name);
        r.remove_player(player_name);
        if (other_online.length) {
          await r.broadcast({
            type: MessageType.PLAYER_LEAVE,
            data: {
              player_name,
              players: r.players.map((p) => ({
                name: p.name,
                is_online: p.is_online,
                isHost: p.is_host,
              })),
            },
          });
        }
        if (r.get_online_players().length === 0) Room.remove(r.id);
      }
      try {
        (player as any).socket = null;
      } catch {}
    });
  }
}
