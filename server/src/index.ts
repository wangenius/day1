import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { Player } from "./Player.js";
import { Room } from "./Room.js";
import { logger } from "./utils/logger.js";

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
    const { room_id, player_id } = req.body;
    const existing = Room.get(room_id);
    if (existing) {
      Room.join(player_id, room_id);
    } else {
      Room.create(room_id);
      Room.join(player_id, room_id);
    }
    logger.info(`玩家 ${player_id} 加入房间 ${room_id}`);
    return res.json({ room_id, success: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// 房间重连
app.post("/rooms/reconnect", (req, res) => {
  const { player_name } = req.body;
  const room = Room.get_by_player(player_name);
  if (!room) return res.json({ room_id: null, success: false });
  logger.info(`房间 ${room.id} 状态: ${room.state}`);
  return res.json({ room_id: room.id, success: true });
});

// 获取房间列表
app.get("/rooms", (_req, res) => {
  try {
    const all = Room.get_all();
    const list: any[] = [];
    for (const [id, room] of Object.entries(all)) {
      const all_players = room.players;
      list.push({
        id,
        player_count: all_players.length,
        room_state: room.state,
        players: all_players.map((p) => ({
          name: p.name,
          is_host: p.is_host,
        })),
      });
    }
    res.json({ success: true, rooms: list, total_count: list.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// 前端连接处理
wss.on("connection", (ws) => {
  Player.connect(ws);
});

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
