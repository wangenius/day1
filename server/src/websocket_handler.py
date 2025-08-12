from fastapi import WebSocket, WebSocketDisconnect
import json
import logging

from room import Player, MessageType
from connection_manager import connection_manager
from room_manager import room_manager
from game_handler import game_handler

logger = logging.getLogger(__name__)


class WebSocketHandler:
    """WebSocket处理器"""

    @staticmethod
    async def handle_connection(websocket: WebSocket):
        """处理WebSocket连接"""
        await websocket.accept()

        try:
            # 等待客户端发送连接信息
            data = await websocket.receive_text()
            connect_data = json.loads(data)

            player_name = connect_data.get("player_name")
            room_id = connect_data.get("room_id")

            if not player_name or not room_id:
                await websocket.close(code=4000, reason="缺少玩家名称或房间ID")
                return

            # 建立连接
            await connection_manager.connect(websocket, player_name)

            # 检查房间是否存在
            room = room_manager.get_room(room_id)
            if not room:
                await websocket.close(code=4004, reason=f"房间 {room_id} 不存在")
                return

            # 检查玩家是否已在房间中，如果不在则加入
            player = room.get_player(player_name)
            if not player:
                # 玩家不在房间中，需要加入
                room = room_manager.join_room(player_name, room_id)
                player = room.get_player(player_name)
                is_reconnect = False
            else:
                # 玩家已在房间中，设置为在线状态（重连）
                player.is_online = True
                is_reconnect = True

            connection_manager.join_room(player_name, room.room_id)

            # 只有在新加入时才广播玩家加入消息
            if not is_reconnect:
                await connection_manager.broadcast_to_room(
                    room.room_id,
                    {
                        "type": MessageType.PLAYER_JOIN,
                        "data": {
                            "player_name": player_name,
                            "players": [
                                {
                                    "name": p.name,
                                    "is_online": p.is_online,
                                    "role": p.role,
                                    "startup_idea": p.startup_idea,
                                    "isHost": p.is_host,
                                }
                                for p in room.players
                            ],
                        },
                    },
                )
            else:
                # 重连时，只向其他玩家发送玩家列表更新
                await connection_manager.broadcast_to_room(
                    room.room_id,
                    {
                        "type": MessageType.PLAYER_JOIN,
                        "data": {
                            "player_name": player_name,
                            "players": [
                                {
                                    "name": p.name,
                                    "is_online": p.is_online,
                                    "role": p.role,
                                    "startup_idea": p.startup_idea,
                                    "isHost": p.is_host,
                                }
                                for p in room.players
                            ],
                        },
                    },
                    exclude_player=player_name,
                )

            # 发送连接成功消息，包含当前游戏状态信息
            connection_data = {
                "type": MessageType.CONNECTION_SUCCESS,
                "data": {
                    "room_id": room_id,
                    "player_name": player_name,
                    "is_reconnect": is_reconnect,
                    # 手动传递room的主要属性，确保JSON序列化兼容
                    "game_state": room.game_state.value if hasattr(room.game_state, 'value') else room.game_state,
                    "current_round": room.current_round,
                    "startup_idea": room.startup_idea,
                    "background": room.background,
                    "dynamic_roles": room.dynamic_roles,
                    "game_result": room.game_result,
                    "round_actions": room.round_actions,
                    "round_events": room.round_events,
                    "round_private_messages": room.round_private_messages,
                    "dynamic_round_info": room.dynamic_round_info,
                    # 格式化players数据以保持前端兼容性
                    "players": [
                        {
                            "name": p.name,
                            "is_online": p.is_online,
                            "role": p.role,
                            "startup_idea": p.startup_idea,
                            "isHost": p.is_host,
                        }
                        for p in room.players
                    ],
                    # 添加一些计算属性
                    "selected_roles": room.get_selected_roles(),
                    "round_info": room.get_round_info(room.current_round),
                },
            }

            # 根据游戏状态添加特定信息
            if room.game_state == "loading":
                connection_data["data"][
                    "loading_message"
                ] = f"AI正在生成第{room.current_round}轮事件，请稍候..."
            elif room.game_state == "playing":
                # 包含当前轮次的事件和私人信息
                if room.round_events and room.current_round in room.round_events:
                    connection_data["data"]["roundEvent"] = room.round_events[
                        room.current_round
                    ]
                if (
                    room.round_private_messages
                    and room.current_round in room.round_private_messages
                ):
                    connection_data["data"]["privateMessages"] = (
                        room.round_private_messages[room.current_round]
                    )
                if room.current_round in room.round_actions:
                    connection_data["data"]["player_actions"] = room.round_actions[
                        room.current_round
                    ]

            await websocket.send_text(json.dumps(connection_data))

        except ValueError as e:
            await websocket.close(code=4004, reason=str(e))
            return
        except Exception as e:
            await websocket.close(code=4001, reason=f"连接失败: {str(e)}")
            return

        try:
            while True:
                # 接收消息
                data = await websocket.receive_text()
                message_data = json.loads(data)

                # 处理消息
                await WebSocketHandler.handle_message(player_name, message_data)

        except WebSocketDisconnect:
            await WebSocketHandler.handle_disconnect(player_name)

    @staticmethod
    async def handle_message(player_name: str, message_data: dict):
        """处理WebSocket消息"""
        try:
            message_type = message_data.get("type")
            data = message_data.get("data", {})

            logger.info(f"收到玩家 {player_name} 的消息: {message_type}")

            # 根据消息类型分发处理
            if message_type == "startup_idea":
                await game_handler.handle_startup_idea(player_name, data.get("idea"))
            elif message_type == "start_game":
                await game_handler.handle_start_game(player_name)
            elif message_type == "select_role":
                await game_handler.handle_role_selection(player_name, data.get("role"))
            elif message_type == "game_action":
                await game_handler.handle_game_action(player_name, data)
            # continue_next_round消息处理已移除，因为现在自动进入下一轮
            elif message_type == "restart_game":
                await game_handler.handle_restart_game(player_name)
            else:
                logger.warning(f"未知消息类型: {message_type}")

        except Exception as e:
            logger.error(f"处理WebSocket消息失败: {e}")

    @staticmethod
    async def handle_disconnect(player_name: str):
        """处理玩家断开连接"""
        # 先获取玩家所在房间ID（在断开连接之前）
        room_id = connection_manager.get_player_room(player_name) or ""
        
        # 处理玩家离线
        if room_id:
            room = room_manager.get_room(room_id)
            if room:
                # 先检查房间是否还有其他在线玩家（在移除当前玩家之前）
                other_online_players = [p for p in room.get_online_players() if p.name != player_name]
                logger.info(f"玩家 {player_name} 断开连接前，房间 {room_id} 还有 {len(other_online_players)} 个其他在线玩家")
                
                # 移除玩家（设为离线状态）
                room.remove_player(player_name)
                logger.info(f"玩家 {player_name} 离开房间 {room_id}")

                # 如果还有其他在线玩家，先通知他们玩家离开
                if other_online_players:
                    logger.info(f"向房间 {room_id} 中的 {len(other_online_players)} 个在线玩家广播 {player_name} 离开消息")
                    await connection_manager.broadcast_to_room(
                        room_id,
                        {
                            "type": MessageType.PLAYER_LEAVE,
                            "data": {
                                "player_name": player_name,
                                "players": [
                                    {
                                        "name": p.name,
                                        "is_online": p.is_online,
                                        "role": p.role,
                                        "startup_idea": p.startup_idea,
                                        "isHost": p.is_host,
                                    }
                                    for p in room.players
                                ],
                            },
                        },
                    )
                    logger.info(f"已完成广播 {player_name} 离开消息")
                else:
                    logger.info(f"房间 {room_id} 没有其他在线玩家，跳过广播离开消息")
                
                # 检查房间是否还有在线玩家（移除当前玩家后的状态）
                remaining_online_players = room.get_online_players()
                logger.info(f"房间 {room_id} 在 {player_name} 离开后还有 {len(remaining_online_players)} 个在线玩家")
                
                if not remaining_online_players:
                    # 房间没有在线玩家，删除房间
                    room_manager.remove_room(room_id)
                    logger.info(f"房间 {room_id} 已清理：无在线玩家")
                else:
                    logger.info(f"房间 {room_id} 保留：还有在线玩家 {[p.name for p in remaining_online_players]}")

        # 最后断开WebSocket连接
        connection_manager.disconnect(player_name)


# 全局WebSocket处理器实例
websocket_handler = WebSocketHandler()
