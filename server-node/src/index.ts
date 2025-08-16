import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { Player } from "./Player.js";
import { room_manager } from "./GameRoomManager.js";

config();

const app = express();
app.use(cors());
app.use(express.json());

// 健康检查
app.get("/", (_req, res) => {
  res.json({ message: "创业模拟器游戏服务器（Node.js）正在运行" });
});

/**
 * 创建房间 当房间存在，则加入房间，否则创建房间，并加入房间
 */
app.post("/rooms/join", (req, res) => {
  try {
    const { room_id, player_name } = req.body || {};
    const existing = room_manager.get_room(room_id);
    if (existing) {
      try {
        room_manager.join_room(player_name, room_id);
      } catch (e: any) {
        return res.json({
          room_id,
          success: false,
          message: e?.message || "房间加入失败",
        });
      }
    } else {
      try {
        room_manager.create_room(room_id);
      } catch (e: any) {
        return res.json({
          room_id,
          success: false,
          message: e?.message || "创建房间失败",
        });
      }
      room_manager.join_room(player_name, room_id);
    }
    return res.json({ room_id, success: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// 获取房间列表
app.get("/rooms", (_req, res) => {
  try {
    const all = room_manager.get_all_rooms();
    const now = Date.now();
    const list: any[] = [];
    for (const [room_id, room] of Object.entries(all)) {
      const online_players = room.get_online_players();
      const all_players = room.players;
      const created_at = (room.created_at as Date)?.toISOString?.() || null;
      const age = now - (room.created_at as Date).getTime();
      const is_new = age < 30 * 1000;
      if (online_players.length) {
        list.push({
          room_id,
          player_count: online_players.length,
          max_players: 4,
          game_state: room.game_state,
          created_at,
          players: online_players.map((p) => ({
            name: p.name,
            is_host: p.is_host,
          })),
        });
      } else if (all_players.length && is_new) {
        list.push({
          room_id,
          player_count: all_players.length,
          max_players: 4,
          game_state: room.game_state,
          created_at,
          players: all_players.map((p) => ({
            name: p.name,
            is_host: p.is_host,
          })),
        });
      }
    }
    res.json({ success: true, rooms: list, total_count: list.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// 获取房间状态
app.get("/rooms/:room_id/status", (req, res) => {
  const { room_id } = req.params;
  const room = room_manager.get_room(room_id);
  if (!room) return res.status(404).json({ error: "房间不存在" });
  return res.json({
    exists: true,
    room_id,
    player_count: room.get_online_players().length,
    game_state: room.game_state,
  });
});

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  Player.handle_connection(ws);
});

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
