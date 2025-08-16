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
  logger.info(`重连成功，房间 ${room.id} 状态: ${room.state}`);
  return res.json({ room_id: room.id, success: true });
});

// 退出房间
app.post("/rooms/exit", async (req, res) => {
  const { player_name } = req.body;

  console.log(req.body);

  console.log(player_name, "退出房间");

  const room = Room.get_by_player(player_name);
  if (room) {
    const player = room.get_player(player_name);

    player?.socket?.close();

    // 完全从房间中移除玩家（非标记离线，而是彻底删除）
    room.remove_player(player_name);

    // 获取移除玩家后的在线玩家列表
    const remaining_online = room.get_online_players();

    // 如果还有其他在线玩家，通知他们该玩家已离开
    if (remaining_online.length) {
      const updatedPlayers = room.getPlayersPayload();
      await room.broadcast({
        type: "player_leave",
        data: {
          player_name,
          players: updatedPlayers,
        },
      });
    }

    // 房间清理：如果房间内没有任何玩家了，删除整个房间
    if (room.get_online_players().length === 0) {
      Room.remove(room.id);
    }

    return res.json({ success: true });
  }

  return res.json({ success: false });
});

// 获取房间列表
app.get("/rooms", (_req, res) => {
  try {
    const all = Room.get_all();
    const list: any[] = [];
    for (const [id, room] of Object.entries(all)) {
      list.push({
        id,
        state: room.state,
        players: room.getPlayersPayload(),
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
