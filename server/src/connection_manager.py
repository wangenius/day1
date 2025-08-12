from typing import Dict, Optional
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        # 玩家ID -> WebSocket连接
        self.active_connections: Dict[str, WebSocket] = {}
        # 玩家ID -> 房间ID
        self.player_rooms: Dict[str, str] = {}

    async def connect(self, websocket: WebSocket, player_id: str):
        """建立WebSocket连接"""
        self.active_connections[player_id] = websocket
        logger.info(f"玩家 {player_id} 已连接")

    def disconnect(self, player_id: str):
        """断开WebSocket连接"""
        if player_id in self.active_connections:
            del self.active_connections[player_id]
        # 同时从房间映射中移除
        if player_id in self.player_rooms:
            del self.player_rooms[player_id]
        logger.info(f"玩家 {player_id} 已断开连接")

    def join_room(self, player_id: str, room_id: str):
        """玩家加入房间"""
        self.player_rooms[player_id] = room_id

    def get_player_room(self, player_id: str) -> Optional[str]:
        """获取玩家所在房间ID"""
        return self.player_rooms.get(player_id)

    async def send_to_player(self, player_id: str, message: dict):
        """发送消息给指定玩家"""
        if player_id in self.active_connections:
            try:
                await self.active_connections[player_id].send_text(
                    json.dumps(message, default=str)
                )
            except Exception as e:
                logger.error(f"发送消息给玩家 {player_id} 失败: {e}")
                self.disconnect(player_id)

    async def broadcast_to_room(
        self, room_id: str, message: dict, exclude_player: Optional[str] = None
    ):
        """向房间内所有玩家广播消息"""
        from room_manager import room_manager  # 避免循环导入
        
        room = room_manager.get_room(room_id)
        if room:
            sent_count = 0
            logger.info(f"房间 {room_id} 开始广播 {message.get('type', 'unknown')} 消息，房间内共有 {len(room.players)} 个玩家")
            for player in room.players:
                logger.info(f"检查玩家 {player.name}: is_online={player.is_online}, in_active_connections={player.name in self.active_connections}")
                if player.is_online and player.name in self.active_connections:
                    if exclude_player and player.name == exclude_player:
                        logger.info(f"跳过发送消息给排除的玩家: {player.name}")
                        continue
                    logger.info(f"发送 {message.get('type', 'unknown')} 消息给玩家: {player.name}")
                    await self.send_to_player(player.name, message)
                    sent_count += 1
                else:
                    logger.info(f"跳过离线或未连接的玩家: {player.name} (is_online: {player.is_online}, connected: {player.name in self.active_connections})")
            logger.info(f"房间 {room_id} 广播消息完成，发送给 {sent_count} 个玩家")
        else:
            logger.warning(f"尝试向不存在的房间 {room_id} 广播消息")

    def get_connected_players(self) -> list:
        """获取所有已连接的玩家列表"""
        return list(self.active_connections.keys())

    def is_player_connected(self, player_id: str) -> bool:
        """检查玩家是否已连接"""
        return player_id in self.active_connections


# 全局连接管理器实例
connection_manager = ConnectionManager()