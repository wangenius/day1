from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import logging

from room_manager import room_manager
from websocket_handler import WebSocketHandler

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="创业模拟器 API", version="1.0.0")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

websocket_handler = WebSocketHandler()


# API 端点
@app.get("/")
async def root():
    return {"message": "创业模拟器游戏服务器正在运行"}


from pydantic import BaseModel


class CreateRoomRequest(BaseModel):
    room_id: str
    player_name: str


@app.post("/rooms/create")
async def create_room(request: CreateRoomRequest):
    try:
        # 检查房间是否已存在
        existing_room = room_manager.get_room(request.room_id)
        if existing_room:
            # 房间已存在，直接加入
            room = room_manager.join_room(request.player_name, request.room_id)
            logger.info(
                f"Player {request.player_name} joined existing room: {request.room_id}"
            )
        else:
            # 房间不存在，创建新房间
            room = room_manager.create_room(request.room_id)
            # 创建者自动加入房间
            room = room_manager.join_room(request.player_name, request.room_id)
            logger.info(
                f"Created room: {request.room_id} and added player: {request.player_name}"
            )

        return {"room_id": request.room_id, "success": True}
    except Exception as e:
        logger.error(f"Error creating/joining room: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class JoinRoomRequest(BaseModel):
    room_id: str
    player_name: str


class EventGenerationRequest(BaseModel):
    round: int
    player_name: str


@app.get("/rooms")
async def get_all_rooms():
    """获取所有房间列表"""
    try:
        all_rooms = room_manager.get_all_rooms()
        logger.info(f"Total rooms before cleanup: {len(all_rooms)}")
        
        # 记录房间状态
        for room_id, room in all_rooms.items():
            online_players = room.get_online_players()
            all_players = room.players
            logger.info(f"Room {room_id}: {len(all_players)} total players, {len(online_players)} online")
            for player in all_players:
                logger.info(f"  Player {player.name}: online={player.is_online}")
        
        room_list = []
        
        for room_id, room in all_rooms.items():
            online_players = room.get_online_players()
            all_players = room.players
            
            # 智能显示逻辑：
            # 1. 优先显示有在线玩家的房间
            # 2. 对于刚创建的房间（可能WebSocket还没连接），给予短暂的宽限期
            from datetime import datetime, timedelta
            room_age = datetime.now() - room.created_at
            is_new_room = room_age < timedelta(seconds=30)  # 30秒宽限期
            
            if online_players:
                # 有在线玩家，直接显示
                display_players = online_players
                room_data = {
                    "room_id": room_id,
                    "player_count": len(display_players),
                    "max_players": 4,
                    "game_state": room.game_state.value if hasattr(room.game_state, 'value') else str(room.game_state),
                    "created_at": room.created_at.isoformat() if room.created_at else None,
                    "players": [{"name": p.name, "is_host": p.is_host} for p in display_players]
                }
                room_list.append(room_data)
                logger.info(f"Added room to list (有在线玩家): {room_data}")
            elif all_players and is_new_room:
                # 新房间且有玩家，给予宽限期（可能WebSocket还在连接中）
                display_players = all_players
                room_data = {
                    "room_id": room_id,
                    "player_count": len(display_players),
                    "max_players": 4,
                    "game_state": room.game_state.value if hasattr(room.game_state, 'value') else str(room.game_state),
                    "created_at": room.created_at.isoformat() if room.created_at else None,
                    "players": [{"name": p.name, "is_host": p.is_host} for p in display_players]
                }
                room_list.append(room_data)
                logger.info(f"Added room to list (新房间宽限期): {room_data}")
            else:
                # 旧房间且无在线玩家，不显示
                logger.info(f"Skipping room {room_id}: 无在线玩家且非新房间 (age: {room_age.total_seconds()}秒)")
        
        result = {
            "success": True,
            "rooms": room_list,
            "total_count": len(room_list)
        }
        logger.info(f"Returning room list: {result}")
        
        return result
    except Exception as e:
        logger.error(f"Error getting room list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/rooms/{room_id}/status")
async def get_room_status(room_id: str):
    """检查房间状态"""
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")

    return {
        "exists": True,
        "room_id": room_id,
        "player_count": len(room.get_online_players()),
        "game_state": room.game_state.value if room.game_state else "waiting",
    }


# WebSocket 端点
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    try:
        await websocket_handler.handle_connection(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
