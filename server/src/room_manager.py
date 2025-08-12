# 房间管理器
from typing import Dict, Optional
from datetime import datetime
import asyncio
from room import GameRoom, Player
from logger_config import logger


class RoomManager:
    """房间管理器"""
    
    def __init__(self):
        self.rooms: Dict[str, GameRoom] = {}
        # 为每个房间创建锁，确保房间级别的操作原子性
        self._room_locks: Dict[str, asyncio.Lock] = {}

    def create_room(self, room_id: str) -> GameRoom:
        """创建房间"""
        if room_id in self.rooms:
            raise ValueError(f"房间 {room_id} 已存在")

        room = GameRoom(room_id=room_id, created_at=datetime.now())
        self.rooms[room_id] = room
        # 为新房间创建锁
        self._room_locks[room_id] = asyncio.Lock()
        logger.info(f"房间 {room_id} 已创建")
        return room

    def get_room(self, room_id: str) -> Optional[GameRoom]:
        """获取房间"""
        return self.rooms.get(room_id)
    
    def get_room_lock(self, room_id: str) -> Optional[asyncio.Lock]:
        """获取房间锁"""
        return self._room_locks.get(room_id)

    def join_room(self, player_name: str, room_id: str) -> GameRoom:
        """玩家加入房间"""
        room = self.get_room(room_id)
        if not room:
            raise ValueError(f"房间 {room_id} 不存在")

        player = Player(name=player_name, joined_at=datetime.now())
        room.add_player(player)
        logger.info(f"玩家 {player_name} 加入房间 {room_id}")
        return room

    def remove_room(self, room_id: str) -> bool:
        """删除房间"""
        if room_id in self.rooms:
            del self.rooms[room_id]
            # 同时删除对应的锁
            if room_id in self._room_locks:
                del self._room_locks[room_id]
            logger.info(f"房间 {room_id} 已删除")
            return True
        return False

    def get_all_rooms(self) -> Dict[str, GameRoom]:
        """获取所有房间"""
        return self.rooms.copy()

    def get_room_count(self) -> int:
        """获取房间总数"""
        return len(self.rooms)

    def cleanup_empty_rooms(self):
        """清理空房间"""
        empty_rooms = []
        for room_id, room in self.rooms.items():
            if not room.get_online_players():
                empty_rooms.append(room_id)
        
        for room_id in empty_rooms:
            self.remove_room(room_id)
            logger.info(f"清理空房间: {room_id}")


# 全局房间管理器实例
room_manager = RoomManager()