from typing import Dict
from datetime import datetime
import logging
import asyncio
import os
import sys

# 添加script目录到Python路径
script_dir = os.path.join(os.path.dirname(__file__), "script")
sys.path.append(script_dir)

from room import GameRoom, GameState, Role, MessageType
from connection_manager import connection_manager
from room_manager import room_manager

logger = logging.getLogger(__name__)


class GameHandler:
    """游戏逻辑处理器"""

    @staticmethod
    async def handle_startup_idea(player_name: str, idea: str):
        """处理创业想法提交"""
        room_id = connection_manager.get_player_room(player_name)
        if not room_id:
            return

        room = room_manager.get_room(room_id)
        if not room:
            return

        player = room.get_player(player_name)
        if not player:
            return

        # 设置玩家的创业想法
        player.startup_idea = idea
        logger.info(f"玩家 {player_name} 提交创业想法: {idea}")

        # 广播玩家想法提交状态更新
        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": MessageType.PLAYER_JOIN,  # 复用PLAYER_JOIN消息类型来更新玩家列表
                "data": {
                    "player_name": player_name,
                    "players": [
                        {
                            "name": p.name,
                            "is_online": p.is_online,
                            "startup_idea": p.startup_idea,
                            "role": p.role.value if p.role else None,
                            "isHost": p.is_host,
                        }
                        for p in room.players
                    ],
                },
            },
        )

        # 检查是否所有玩家都提交了想法
        if room.all_players_have_ideas():
            # 选择一个想法作为团队的创业想法（这里简单选择第一个）
            room.startup_idea = room.get_online_players()[0].startup_idea
            logger.info(
                f"房间 {room_id} 确定创业想法: {room.startup_idea}， 确认创业想法之后应该直接开始游戏。"
            )

            # 广播所有想法已提交完成，可以开始游戏
            await connection_manager.broadcast_to_room(
                room_id,
                {
                    "type": MessageType.IDEAS_COMPLETE,
                    "data": {
                        "startup_idea": room.startup_idea,
                        "players": [
                            {
                                "name": p.name,
                                "is_online": p.is_online,
                                "startup_idea": p.startup_idea,
                                "role": p.role.value if p.role else None,
                                "isHost": p.is_host,
                            }
                            for p in room.players
                        ],
                    },
                },
            )

    @staticmethod
    async def _auto_start_game(room_id: str):
        """自动开始游戏（内部方法）"""
        room = room_manager.get_room(room_id)
        if not room:
            return

        # 只有在大厅状态时才能开始游戏
        if room.game_state == GameState.LOBBY:
            # 先广播游戏开始加载消息
            await connection_manager.broadcast_to_room(
                room_id,
                {
                    "type": MessageType.GAME_LOADING,
                    "data": {"message": "AI正在生成游戏背景，请稍候..."},
                },
            )

            # 收集所有玩家的想法
            player_ideas = [
                p.startup_idea for p in room.get_online_players() if p.startup_idea
            ]

            # 生成背景故事
            try:
                background = await asyncio.get_event_loop().run_in_executor(
                    None,
                    room.generate_background_from_ideas,
                    player_ideas,
                )
                room.background = background
                logger.info(f"房间 {room_id} 生成背景故事: {background}")
                logger.info(f"房间 {room_id} 生成背景故事成功")
            except Exception as e:
                logger.error(f"房间 {room_id} 生成背景故事失败: {str(e)}")
                # 如果生成失败，使用默认背景
                room.background = "创业团队正在开始他们的创业之旅..."

            # 根据背景故事生成动态角色定义
            dynamic_roles = {}  # 默认使用硬编码角色
            try:
                generated_roles = await asyncio.get_event_loop().run_in_executor(
                    None,
                    room.generate_roles_from_background,
                    room.background,
                )
                # 转换生成的角色格式以匹配前端期望的格式
                dynamic_roles = {}
                for role_key, role_data in generated_roles.items():
                    try:
                        action = role_data.get("actions", [])
                    except ValueError:
                        # 如果角色键无效，使用空的actions列表
                        action = []

                    dynamic_roles[role_key] = {
                        "name": role_data["name"],
                        "description": role_data["description"],
                        "actions": action,
                    }
                # 保存动态角色定义到房间状态中
                room.dynamic_roles = dynamic_roles
                logger.info(f"房间 {room_id} 生成动态角色定义成功")
            except Exception as e:
                logger.error(f"房间 {room_id} 生成动态角色定义失败: {str(e)}")
                # 如果生成失败，使用默认角色定义
                dynamic_roles = {}

            room.game_state = GameState.ROLE_SELECTION
            logger.info(f"房间 {room_id} 自动开始游戏，进入角色选择阶段")

            await connection_manager.broadcast_to_room(
                room_id,
                {
                    "type": MessageType.GAME_START,
                    "data": {
                        "startup_idea": room.startup_idea,
                        "background": room.background,
                        "roles": dynamic_roles,
                    },
                },
            )

    @staticmethod
    async def handle_start_game(player_name: str):
        """处理开始游戏"""
        room_id = connection_manager.get_player_room(player_name)
        if not room_id:
            return

        room = room_manager.get_room(room_id)
        if not room:
            return

        player = room.get_player(player_name)
        if not player or not player.is_host:
            return

        # 在大厅状态时生成背景和角色，在角色选择状态时开始第一轮游戏
        if room.game_state == GameState.LOBBY:
            # 先广播游戏开始加载消息
            await connection_manager.broadcast_to_room(
                room_id,
                {
                    "type": MessageType.GAME_LOADING,
                    "data": {"message": "AI正在生成游戏背景，请稍候..."},
                },
            )

            # 收集所有玩家的想法
            player_ideas = [
                p.startup_idea for p in room.get_online_players() if p.startup_idea
            ]

            # 生成背景故事
            try:
                background = await asyncio.get_event_loop().run_in_executor(
                    None,
                    room.generate_background_from_ideas,
                    player_ideas,
                )
                room.background = background
                logger.info(f"房间 {room_id} 生成背景故事: {background}")
                logger.info(f"房间 {room_id} 生成背景故事成功")
            except Exception as e:
                logger.error(f"房间 {room_id} 生成背景故事失败: {str(e)}")
                # 如果生成失败，使用默认背景
                room.background = "创业团队正在开始他们的创业之旅..."

            # 根据背景故事生成动态角色定义
            dynamic_roles = {}  # 默认使用硬编码角色
            try:
                generated_roles = await asyncio.get_event_loop().run_in_executor(
                    None,
                    room.generate_roles_from_background,
                    room.background,
                )
                # 转换生成的角色格式以匹配前端期望的格式
                dynamic_roles = {}
                for role_key, role_data in generated_roles.items():
                    try:
                        action = role_data.get("actions", [])
                    except ValueError:
                        # 如果角色键无效，使用空的actions列表
                        action = []

                    dynamic_roles[role_key] = {
                        "name": role_data["name"],
                        "description": role_data["description"],
                        "actions": action,
                    }
                # 保存动态角色定义到房间状态中
                room.dynamic_roles = dynamic_roles
                logger.info(f"房间 {room_id} 生成动态角色定义成功")
            except Exception as e:
                logger.error(f"房间 {room_id} 生成动态角色定义失败: {str(e)}")
                # 如果生成失败，使用默认角色定义
                dynamic_roles = {}

            room.game_state = GameState.ROLE_SELECTION
            logger.info(f"房间 {room_id} 开始游戏，进入角色选择阶段")

            await connection_manager.broadcast_to_room(
                room_id,
                {
                    "type": MessageType.GAME_START,
                    "data": {
                        "startup_idea": room.startup_idea,
                        "background": room.background,
                        "roles": dynamic_roles,
                    },
                },
            )

        # 角色选择完成后会自动开始游戏，不再需要房主手动开始

    @staticmethod
    async def handle_role_selection(player_name: str, role: str):
        """处理角色选择 - 使用锁确保原子性"""
        room_id = connection_manager.get_player_room(player_name)
        if not room_id:
            logger.warning(f"玩家 {player_name} 未找到房间")
            return

        room = room_manager.get_room(room_id)
        if not room:
            logger.warning(f"房间 {room_id} 不存在")
            return

        # 获取房间锁，确保角色选择的原子性
        room_lock = room_manager.get_room_lock(room_id)
        if not room_lock:
            logger.error(f"房间 {room_id} 缺少锁")
            return

        # 使用异步锁确保整个角色选择操作的原子性
        async with room_lock:
            logger.info(f"玩家 {player_name} 获得房间 {room_id} 锁，开始角色选择")
            
            player = room.get_player(player_name)
            if not player:
                logger.warning(f"玩家 {player_name} 在房间 {room_id} 中不存在")
                return

            # 检查玩家是否已经选择过角色
            if player.role:
                logger.warning(f"玩家 {player_name} 已经选择过角色: {player.role}")
                await connection_manager.send_to_player(
                    player_name,
                    {
                        "type": "role_selection_error",
                        "data": {"message": "你已经选择过角色了"},
                    },
                )
                return

            # 检查角色是否有效 - 直接使用原始角色值，因为枚举值是大写的
            if role not in [r.value for r in Role]:
                logger.warning(f"无效的角色: {role}")
                await connection_manager.send_to_player(
                    player_name,
                    {
                        "type": "role_selection_error",
                        "data": {"message": f"无效的角色: {role}"},
                    },
                )
                return

            # 原子性角色冲突检查 - 在锁保护下进行
            online_players = room.get_online_players()
            for p in online_players:
                if p.name != player_name and p.role and p.role.value == role:
                    logger.warning(f"角色 {role} 已被玩家 {p.name} 选择")
                    await connection_manager.send_to_player(
                        player_name,
                        {
                            "type": "role_selection_error",
                            "data": {"message": f"角色 {role} 已被其他玩家选择，请选择其他角色"},
                        },
                    )
                    return

            # 原子性设置玩家角色
            try:
                player.role = Role(role)
                logger.info(f"玩家 {player_name} 成功选择角色: {role}")
            except Exception as e:
                logger.error(f"设置玩家 {player_name} 角色失败: {str(e)}")
                await connection_manager.send_to_player(
                    player_name,
                    {
                        "type": "role_selection_error",
                        "data": {"message": "角色设置失败，请重试"},
                    },
                )
                return

            # 广播角色选择成功
            await connection_manager.broadcast_to_room(
                room_id,
                {
                    "type": MessageType.ROLE_SELECTED,
                    "data": {
                        "selectedRoles": room.get_selected_roles(),
                        "players": [
                            {
                                "name": p.name,
                                "is_online": p.is_online,
                                "role": p.role.value if p.role else None,
                                "startup_idea": p.startup_idea,
                                "isHost": p.is_host,
                            }
                            for p in room.players
                        ],
                    },
                },
            )

            # 检查是否所有玩家都选择了角色
            if room.all_players_have_roles():
                logger.info(f"房间 {room_id} 所有角色已选择，直接开始游戏")

                # 所有玩家选择完角色后，直接开始游戏
                await GameHandler._auto_start_game_after_role_selection(room_id)
            
            logger.info(f"玩家 {player_name} 角色选择处理完成，释放房间 {room_id} 锁")

    @staticmethod
    async def _auto_start_game_after_role_selection(room_id: str):
        """角色选择完成后开始第一轮游戏（内部方法）"""
        room = room_manager.get_room(room_id)
        if not room:
            return

        logger.info(f"房间 {room_id} 所有角色已选择，开始生成游戏内容")

        # 第一步：广播进入loading状态
        room.game_state = GameState.LOADING
        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": MessageType.GAME_LOADING,
                "data": {"message": "AI正在生成游戏背景和角色介绍，请稍候..."},
            },
        )

        # 第二步：生成背景故事（如果还没有生成）
        if not room.background:
            # 收集所有玩家的想法
            player_ideas = [
                p.startup_idea for p in room.get_online_players() if p.startup_idea
            ]

            try:
                background = await asyncio.get_event_loop().run_in_executor(
                    None,
                    room.generate_background_from_ideas,
                    player_ideas,
                )
                room.background = background
                logger.info(f"房间 {room_id} 生成背景故事成功")
            except Exception as e:
                logger.error(f"房间 {room_id} 生成背景故事失败: {str(e)}")
                # 如果生成失败，使用默认背景
                room.background = "创业团队正在开始他们的创业之旅..."

        # 第三步：生成角色介绍（如果还没有生成）
        if not room.dynamic_roles:
            try:
                generated_roles = await asyncio.get_event_loop().run_in_executor(
                    None,
                    room.generate_roles_from_background,
                    room.background,
                )
                # 转换生成的角色格式以匹配前端期望的格式
                dynamic_roles = {}
                for role_key, role_data in generated_roles.items():
                    try:
                        action = role_data.get("actions", [])
                    except ValueError:
                        # 如果角色键无效，使用空的actions列表
                        action = []

                    dynamic_roles[role_key] = {
                        "name": role_data["name"],
                        "description": role_data["description"],
                        "actions": action,
                    }
                # 保存动态角色定义到房间状态中
                room.dynamic_roles = dynamic_roles
                logger.info(f"房间 {room_id} 生成动态角色定义成功")
            except Exception as e:
                logger.error(f"房间 {room_id} 生成动态角色定义失败: {str(e)}")
                # 如果生成失败，使用默认角色定义
                room.dynamic_roles = {}

        # 第四步：广播背景故事和角色介绍
        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": MessageType.GAME_START,
                "data": {
                    "startup_idea": room.startup_idea,
                    "background": room.background,
                    "roles": room.dynamic_roles,
                },
            },
        )

        # 第五步：开始生成第一轮事件
        room.current_round = 1
        logger.info(f"房间 {room_id} 开始生成第1轮事件")

        # 广播第一轮事件加载状态
        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": MessageType.ROUND_LOADING,
                "data": {"round": 1, "message": "AI正在生成第1轮事件，请稍候..."},
            },
        )

        # 生成第一轮事件
        # 调用房间的generate_event方法，该方法已经包含了重试机制和默认事件处理
        event_data = await asyncio.get_event_loop().run_in_executor(
            None, room.generate_event, 1
        )

        # 保存事件和私人信息到房间状态
        room.round_events[1] = event_data["event"]
        room.round_private_messages[1] = event_data["private_messages"]
        if "situation" in event_data:
            room.round_situation[1] = event_data["situation"]

        is_default_event = event_data.get("is_default_event", False)
        if is_default_event:
            logger.warning(f"房间 {room_id} 第1轮使用了默认事件")
        else:
            logger.info(f"房间 {room_id} 第1轮事件生成成功")

        # 第六步：设置游戏状态为进行中并广播游戏开始消息
        room.game_state = GameState.PLAYING
        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": MessageType.GAME_STARTED,
                "data": {
                    "round": 1,
                    "roundEvent": room.round_events[1],
                    "privateMessages": room.round_private_messages[1],
                    "isDefaultEvent": is_default_event,  # 传递默认事件标志
                },
            },
        )

    @staticmethod
    async def handle_game_action(player_name: str, action_data: Dict):
        """处理游戏行动"""
        room_id = connection_manager.get_player_room(player_name)
        if not room_id:
            return

        room = room_manager.get_room(room_id)
        if not room or room.game_state != GameState.PLAYING:
            return

        player = room.get_player(player_name)
        if not player:
            return

        # 构建行动数据
        action = {
            "playerName": player_name,  # 修正为前端期望的字段名
            "actionType": "decision",   # 添加前端期望的字段
            "action": action_data.get("action"),
            "round": room.current_round,  # 添加轮次信息
            "role": player.role,
            "reason": action_data.get("reason"),
            "timestamp": datetime.now().isoformat(),
        }

        room.add_round_action(room.current_round, action)
        logger.info(
            f"玩家 {player_name} 提交第{room.current_round}轮行动: {action['action']}"
        )

        # 广播行动提交
        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": MessageType.ACTION_SUBMITTED,
                "data": {
                    "playerActions": room.round_actions.get(room.current_round, []),
                    "waitingForPlayers": not room.all_players_submitted_actions(
                        room.current_round
                    ),
                },
            },
        )

        # 检查是否所有玩家都提交了行动
        if room.all_players_submitted_actions(room.current_round):
            await GameHandler._handle_round_complete(room_id, room)

    @staticmethod
    async def _handle_round_complete(room_id: str, room: GameRoom):
        """处理轮次完成"""
        logger.info(f"房间 {room_id} 第{room.current_round}轮完成")

        # 检查是否游戏结束
        if room.current_round >= 5:
            await GameHandler._handle_game_complete(room_id, room)
        else:
            # 直接进入下一轮，不显示RoundResult页面
            await GameHandler._start_next_round(room_id, room)

    @staticmethod
    async def _handle_game_complete(room_id: str, room: GameRoom):
        """处理游戏完成"""
        # 先广播游戏结果计算中的Loading状态
        room.game_state = GameState.LOADING
        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": MessageType.GAME_LOADING,
                "data": {"message": "AI正在分析游戏结果，请稍候..."},
            },
        )
        
        # 计算游戏结果
        room.game_state = GameState.FINISHED
        room.game_result = room.calculate_game_result()
        logger.info(f"房间 {room_id} 游戏结束")

        await connection_manager.broadcast_to_room(
            room_id,
            {"type": MessageType.GAME_COMPLETE, "data": {"result": room.game_result}},
        )

    # handle_continue_next_round方法已移除，因为现在自动进入下一轮

    @staticmethod
    async def _start_next_round(room_id: str, room):
        """开始下一轮"""
        room.current_round += 1
        logger.info(f"房间 {room_id} 开始第{room.current_round}轮")

        # 先广播回合加载状态
        room.game_state = GameState.LOADING
        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": MessageType.ROUND_LOADING,
                "data": {
                    "round": room.current_round,
                    "message": f"AI正在生成第{room.current_round}轮事件，请稍候...",
                },
            },
        )

        # 生成当前轮次的事件
        # 设置之前的输出用于生成连贯的事件
        if room.current_round > 1:
            previous_round = room.current_round - 1
            if previous_round in room.round_actions:
                room.round_situation[room.current_round] = {
                    "round": previous_round,
                    "players_choices": {},  # 这里可以根据实际行动数据构建
                    "final_choice": 1,  # 简化处理
                    "impact": "上一轮的决策产生了影响...",
                }

        # 调用房间的generate_event方法，该方法已经包含了重试机制和默认事件处理
        event_data = await asyncio.get_event_loop().run_in_executor(
            None, room.generate_event, room.current_round
        )

        # 保存事件和私人信息到房间状态
        room.round_events[room.current_round] = event_data["event"]
        room.round_private_messages[room.current_round] = event_data[
            "private_messages"
        ]
        if "situation" in event_data:
            room.round_situation[room.current_round] = event_data["situation"]

        is_default_event = event_data.get("is_default_event", False)
        if is_default_event:
            logger.warning(f"房间 {room_id} 第{room.current_round}轮使用了默认事件")
        else:
            logger.info(f"房间 {room_id} 第{room.current_round}轮事件生成成功")
        logger.info(f"私人信息内容: {event_data['private_messages']}")

        # 设置游戏状态为进行中并广播轮次开始
        room.game_state = GameState.PLAYING
        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": MessageType.ROUND_START,
                "data": {
                    "round": room.current_round,
                    "roundInfo": room.get_round_info(room.current_round),
                    "roundEvent": room.round_events[room.current_round],
                    "privateMessages": room.round_private_messages[room.current_round],
                    "isDefaultEvent": is_default_event,  # 传递默认事件标志
                },
            },
        )

    @staticmethod
    async def handle_restart_game(player_name: str):
        """处理游戏重新开始"""
        room_id = connection_manager.get_player_room(player_name)
        if not room_id:
            return

        room = room_manager.get_room(room_id)
        if not room:
            return

        player = room.get_player(player_name)
        if not player or not player.is_host:
            return

        # 只有房主可以重新开始游戏
        room.restart_game()
        logger.info(f"房间 {room_id} 游戏重新开始")

        await connection_manager.broadcast_to_room(
            room_id,
            {
                "type": MessageType.GAME_RESTART,
                "data": {
                    "players": [
                        {
                            "name": p.name,
                            "is_online": p.is_online,
                            "role": p.role.value if p.role else None,
                            "startup_idea": p.startup_idea,
                            "isHost": p.is_host,
                        }
                        for p in room.players
                    ],
                },
            },
        )


# 全局游戏处理器实例
game_handler = GameHandler()
