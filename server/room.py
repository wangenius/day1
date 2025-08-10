from enum import Enum
from typing import Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel
import random
import os
import logging
from llm import LLM

logger = logging.getLogger(__name__)

# 读取prompt模板
with open(
    os.path.join(os.path.dirname(__file__), "prompt", "role_generation.txt"),
    "r",
    encoding="utf-8",
) as f:
    role_generator = f.read()

# 读取prompt模板
with open(
    os.path.join(os.path.dirname(__file__), "prompt", "prompt1.txt"),
    "r",
    encoding="utf-8",
) as f:
    prompt_template = f.read()

# 读取prompt模板
with open(
    os.path.join(os.path.dirname(__file__), "prompt", "prompt2.txt"),
    "r",
    encoding="utf-8",
) as f:
    prompt2_template = f.read()

with open(
    os.path.join(os.path.dirname(__file__), "prompt", "prompt3.txt"),
    "r",
    encoding="utf-8",
) as f:
    prompt3_template = f.read()

with open(
    os.path.join(os.path.dirname(__file__), "prompt", "prompt4.txt"),
    "r",
    encoding="utf-8",
) as f:
    prompt4_template = f.read()


# 枚举定义
class MessageType(str, Enum):
    PLAYER_JOIN = "player_join"
    PLAYER_LEAVE = "player_leave"
    GAME_LOADING = "game_loading"
    GAME_START = "game_start"
    TRANSITION_ANIMATION = "transition_animation"
    GAME_STARTED = "game_started"
    IDEAS_COMPLETE = "ideas_complete"
    ROLE_SELECTED = "role_selected"
    ROLES_COMPLETE = "roles_complete"
    ROUND_LOADING = "round_loading"
    ROUND_START = "round_start"
    ACTION_SUBMITTED = "action_submitted"
    ROUND_COMPLETE = "round_complete"
    GAME_COMPLETE = "game_complete"
    GAME_RESTART = "game_restart"
    CONNECTION_SUCCESS = "connection_success"


class GameState(str, Enum):
    LOBBY = "lobby"
    ROLE_SELECTION = "role_selection"
    LOADING = "loading"  # 游戏加载状态
    PLAYING = "playing"
    FINISHED = "finished"


class Role(str, Enum):
    CEO = "ceo"
    CTO = "cto"
    CMO = "cmo"
    COO = "coo"


# 数据模型
class Player(BaseModel):
    name: str
    is_online: bool = True
    joined_at: datetime
    role: Optional[Role] = None
    startup_idea: Optional[str] = None
    is_host: bool = False
    actions: List[Dict] = []


class GameRoom(BaseModel):
    room_id: str
    players: List[Player] = []
    created_at: datetime
    game_state: GameState = GameState.LOBBY
    current_round: int = 1
    # 废弃
    startup_idea: Optional[str] = None
    background: Optional[str] = None  # 本轮游戏的背景
    dynamic_roles: Optional[Dict] = None  # 保存动态生成的角色定义
    game_result: Optional[Dict] = None
    round_actions: Dict[int, List[Dict]] = {}
    round_events: Dict[int, Dict] = {}  # 保存每轮的事件和选项
    round_private_messages: Dict[int, Dict] = {}  # 保存每轮的私人信息
    dynamic_round_info: Dict[int, str] = {}  # 保存动态生成的轮次信息
    round_situation: Dict[int, str] = {}  # 保存每轮的情况

    def add_player(self, player: Player) -> bool:
        """添加玩家到房间"""
        # 检查玩家是否已存在
        existing_player = self.get_player(player.name)
        if existing_player:
            existing_player.is_online = True
            return True

        # 如果是第一个玩家，设为房主
        if not self.players:
            player.is_host = True

        self.players.append(player)
        return True

    def remove_player(self, player_name: str) -> bool:
        """移除玩家（设为离线状态）"""
        player = self.get_player(player_name)
        if player:
            player.is_online = False
        return True

    def get_player(self, player_name: str) -> Optional[Player]:
        """根据名称获取玩家"""
        for player in self.players:
            if player.name == player_name:
                return player
        return None

    def get_online_players(self) -> List[Player]:
        """获取在线玩家列表"""
        return [p for p in self.players if p.is_online]

    def all_players_have_ideas(self) -> bool:
        """检查是否所有玩家都提交了创业想法"""
        online_players = self.get_online_players()
        return all(p.startup_idea for p in online_players)

    def all_players_have_roles(self) -> bool:
        """检查是否所有玩家都选择了角色"""
        online_players = self.get_online_players()
        return all(p.role for p in online_players)

    def get_selected_roles(self) -> List[str]:
        """获取已选择的角色列表"""
        return [p.role for p in self.players if p.role]

    def all_players_submitted_actions(self, round_num: int) -> bool:
        """检查是否所有玩家都提交了当前轮次的行动"""
        online_players = self.get_online_players()
        submitted_players = set()

        if round_num in self.round_actions:
            for action in self.round_actions[round_num]:
                submitted_players.add(action.get("playerName"))  # 修正字段名

        return len(submitted_players) == len(online_players)

    def add_round_action(self, round_num: int, action: Dict):
        """添加轮次行动"""
        if round_num not in self.round_actions:
            self.round_actions[round_num] = []

        # 移除该玩家之前的行动（如果有）
        self.round_actions[round_num] = [
            a
            for a in self.round_actions[round_num]
            if a.get("playerName") != action.get("playerName")  # 修正字段名
        ]

        self.round_actions[round_num].append(action)

    def get_round_info(self, round_num: int) -> str:
        """获取指定轮次的信息"""
        # 如果有动态生成的轮次信息，优先使用
        if round_num in self.dynamic_round_info:
            return self.dynamic_round_info[round_num]

        # 否则使用默认模板
        return ""

    def set_round_info(self, round_num: int, info: str):
        """设置指定轮次的动态信息"""
        self.dynamic_round_info[round_num] = info

    def generate_background_from_ideas(self, player_ideas):
        """根据所有玩家的想法生成背景"""
        if not player_ideas:
            raise ValueError("没有玩家想法")

        # 将所有想法合并为一个字符串
        combined_ideas = "\n".join([f"- {idea}" for idea in player_ideas if idea])

        # 填充prompt模板
        prompt = prompt_template.replace("{initial_idea}", combined_ideas)
        
        # 生成玩家信息字符串
        players_info = []
        for player in self.players:
            if player.is_online:
                role_name = player.role.value if player.role else "未选择角色"
                players_info.append(f"{player.name}({role_name})")
        players_str = "、".join(players_info)
        
        prompt = prompt.replace("{players}", players_str)

        try:
            self.background = LLM().text(prompt, temperature=0.7)
            return self.background
        except Exception as e:
            raise Exception(f"生成背景导入词失败: {str(e)}")

    def generate_roles_from_background(self, background):
        """根据游戏背景生成角色定义"""
        if not background:
            raise ValueError("背景故事不能为空")

        # 填充prompt模板
        prompt = role_generator.replace("{background}", background)

        try:
            # 使用LLM生成角色定义，直接获取JSON格式响应
            role_definitions = LLM().json(prompt, temperature=0.7)

            return role_definitions
        except Exception as e:
            raise Exception(f"生成角色定义失败: {str(e)}")

    def generate_event(self, round_num):
        # 填充prompt2模板
        prompt = prompt2_template.replace("{background}", self.background or "")
        
        # 替换current_round占位符
        prompt = prompt.replace("{current_round}", str(round_num))
        
        # 替换initial_idea占位符
        # 从玩家的startup_idea中获取初始想法
        initial_ideas = [player.startup_idea for player in self.players if player.startup_idea]
        combined_ideas = "\n".join([f"- {idea}" for idea in initial_ideas]) if initial_ideas else "创业想法"
        prompt = prompt.replace("{initial_idea}", combined_ideas)
        
        # 替换situation/previous_output占位符
        if round_num in self.round_situation:
            # 如果round_situation是字典，需要转换为字符串
            situation_data = self.round_situation[round_num]
            if isinstance(situation_data, dict):
                situation_str = f"第{situation_data.get('round', round_num-1)}轮的决策结果：{situation_data.get('impact', '上一轮的决策产生了影响...')}"
            else:
                situation_str = str(situation_data)
            prompt = prompt.replace("{situation}", situation_str)
            prompt = prompt.replace("{previous_output}", situation_str)
        else:
            default_situation = "这是第一轮决策，暂无上一轮结果"
            prompt = prompt.replace("{situation}", default_situation)
            prompt = prompt.replace("{previous_output}", default_situation)

        # 添加重试机制，最多重试3次
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response_json = LLM().json(prompt, temperature=0.7)
                
                # 添加调试信息
                print(f"本轮事件的信息: {response_json}")
                
                # 验证返回的JSON结构
                if not self._validate_event_response(response_json):
                    raise ValueError("返回的JSON结构不完整")
                
                # 返回完整的事件数据，包含私人信息
                return {
                    "situation": response_json.get("situation", ""),
                    "event": response_json.get("event", ""),
                    "private_messages": response_json.get("private_messages", {}),
                    "is_default_event": False  # 标记这是AI生成的事件
                }
            except Exception as e:
                logger.error(f"第{attempt + 1}次尝试生成第{round_num}轮事件失败: {str(e)}")
                if attempt == max_retries - 1:
                    # 最后一次重试失败，返回默认事件
                    logger.error(f"生成第{round_num}轮事件彻底失败，使用默认事件")
                    return self._get_default_event(round_num)
                # 稍微调整temperature重试
                prompt = prompt.replace("temperature=0.7", f"temperature={0.5 + attempt * 0.1}")
        
        # 兜底返回默认事件
        return self._get_default_event(round_num)
    
    def _validate_event_response(self, response_json):
        """验证事件响应的JSON结构"""
        if not isinstance(response_json, dict):
            return False
        
        # 检查必需的字段
        required_fields = ["event", "private_messages"]
        for field in required_fields:
            if field not in response_json:
                return False
        
        # 检查event字段结构
        event = response_json.get("event", {})
        if not isinstance(event, dict):
            return False
        
        event_required_fields = ["event_title", "event_description", "decision_options"]
        for field in event_required_fields:
            if field not in event:
                return False
        
        # 检查private_messages字段结构
        private_messages = response_json.get("private_messages", {})
        if not isinstance(private_messages, dict):
            return False
        
        # 检查是否包含所有角色的私信
        required_roles = ["CEO", "CTO", "CMO", "COO"]
        for role in required_roles:
            if role not in private_messages:
                return False
        
        return True
    
    def _get_default_event(self, round_num):
        """获取默认事件（当AI生成失败时使用）"""
        default_events = {
            1: {
                "event_title": "团队组建挑战",
                "event_description": "创业初期，团队需要明确各自职责和合作方式，面临第一个重要的团队决策。",
                "decision_options": {
                    "A": "立即制定详细的工作分工和流程规范",
                    "B": "保持灵活性，根据实际情况逐步调整",
                    "C": "优先建立团队文化和价值观共识"
                }
            },
            2: {
                "event_title": "产品开发方向",
                "event_description": "产品概念基本确定，现在需要决定开发的优先级和技术路线。",
                "decision_options": {
                    "A": "专注核心功能，快速打造MVP版本",
                    "B": "全面开发，确保产品功能完整",
                    "C": "重点研发创新技术，追求技术突破"
                }
            },
            3: {
                "event_title": "市场进入策略",
                "event_description": "产品开发接近完成，需要制定市场推广和用户获取策略。",
                "decision_options": {
                    "A": "大规模营销推广，快速占领市场",
                    "B": "精准定位目标用户，稳步推进",
                    "C": "先在小范围测试，收集反馈后调整"
                }
            },
            4: {
                "event_title": "融资决策",
                "event_description": "公司发展到关键阶段，面临重要的融资选择和股权决策。",
                "decision_options": {
                    "A": "积极寻求风险投资，加速发展",
                    "B": "保持自主发展，控制股权稀释",
                    "C": "寻找战略投资者，获得资源支持"
                }
            },
            5: {
                "event_title": "规模化挑战",
                "event_description": "业务快速增长，需要决定如何应对规模化带来的挑战。",
                "decision_options": {
                    "A": "大力扩张团队和业务规模",
                    "B": "优化现有流程，提高运营效率",
                    "C": "多元化发展，拓展新的业务线"
                }
            }
        }
        
        # 如果轮次超出预定义范围，使用最后一个事件模板
        event_data = default_events.get(round_num, default_events[5])
        
        # 生成默认私信
        default_private_messages = {
            "CEO": f"第{round_num}轮：作为CEO，你需要权衡各方利益，做出最终决策。",
            "CTO": f"第{round_num}轮：从技术角度分析，每个选项都有其技术可行性和风险。",
            "CMO": f"第{round_num}轮：市场竞争激烈，需要考虑用户反应和品牌影响。",
            "COO": f"第{round_num}轮：运营成本和效率是关键考虑因素。"
        }
        
        return {
            "situation": f"第{round_num}轮：公司发展进入新阶段，面临重要决策。",
            "event": event_data,
            "private_messages": default_private_messages,
            "is_default_event": True  # 标记这是默认事件
        }

    def calculate_game_result(self) -> Dict:
        """计算游戏结果"""
        # 简化的游戏结果计算
        base_score = 50
        user_growth = random.randint(1000, 100000)
        revenue = random.randint(10000, 1000000)
        market_share = random.randint(1, 25)
        team_size = random.randint(5, 100)

        # 根据玩家行动调整分数
        total_actions = sum(len(actions) for actions in self.round_actions.values())
        score_bonus = min(total_actions * 2, 50)
        final_score = base_score + score_bonus

        # 确定成功级别
        if final_score >= 90:
            success_level = "独角兽公司"
        elif final_score >= 75:
            success_level = "成功上市"
        elif final_score >= 60:
            success_level = "盈利稳定"
        elif final_score >= 45:
            success_level = "勉强生存"
        else:
            success_level = "创业失败"

        # 计算玩家表现
        player_performance = self._calculate_player_performance()

        # 生成玩家分数字典，确保前端兼容性
        player_scores = {}
        for perf in player_performance:
            player_scores[perf["player"]] = min(50 + perf["contribution_score"], 100)

        # 生成最终报告
        try:
            final_report = self.generate_final_report()
        except Exception as e:
            print(f"生成最终报告失败: {e}")
            final_report = "报告生成失败，请稍后重试。"

        return {
            "final_score": final_score,
            "success_level": success_level,
            "metrics": {
                "user_growth": user_growth,
                "revenue": revenue,
                "market_share": market_share,
                "team_size": team_size,
            },
            "achievements": self._generate_achievements(final_score),
            "timeline": self._generate_timeline(),
            "player_performance": player_performance,
            "playerScores": player_scores,
            "final_report": final_report,
        }

    def _generate_achievements(self, score: int) -> List[str]:
        """生成成就列表"""
        achievements = []
        if score >= 90:
            achievements.extend(["🦄 独角兽成就", "💰 十亿美元估值", "🌟 行业领导者"])
        elif score >= 75:
            achievements.extend(["📈 成功IPO", "🏆 年度最佳创业公司", "🌍 国际化扩张"])
        elif score >= 60:
            achievements.extend(["💼 盈利达成", "👥 团队建设专家", "📊 市场份额突破"])
        elif score >= 45:
            achievements.extend(["🎯 产品上线", "💡 创新思维", "🤝 团队协作"])
        return achievements

    def _generate_timeline(self) -> List[Dict]:
        """生成发展历程"""
        return [
            {"round": 1, "event": "产品原型开发完成", "impact": "positive"},
            {"round": 2, "event": "获得首批用户", "impact": "positive"},
            {"round": 3, "event": "完成A轮融资", "impact": "positive"},
            {"round": 4, "event": "市场竞争加剧", "impact": "negative"},
            {"round": 5, "event": "战略合作达成", "impact": "positive"},
        ]

    def _calculate_player_performance(self) -> List[Dict]:
        """计算玩家表现"""
        performance = []
        for player in self.players:
            action_count = sum(
                1
                for round_actions in self.round_actions.values()
                for action in round_actions
                if action.get("player") == player.name
            )

            performance.append(
                {
                    "player": player.name,
                    "role": player.role,
                    "actions_taken": action_count,
                    "contribution_score": min(action_count * 10, 50),
                }
            )

        return performance

    def generate_final_report(self) -> str:
        """使用prompt4模板生成最终的创业报告"""
        # 获取初始创业想法
        initial_ideas = [player.startup_idea for player in self.players if player.startup_idea]
        combined_ideas = "\n".join([f"- {idea}" for idea in initial_ideas]) if initial_ideas else "创业想法"
        
        # 获取每轮的分析结果
        round_outputs = []
        for round_num in range(1, 6):
            round_output_parts = []
            
            # 获取轮次情况
            if round_num in self.round_situation:
                situation_data = self.round_situation[round_num]
                if isinstance(situation_data, dict):
                    situation = situation_data.get('impact', '上一轮的决策产生了影响...')
                else:
                    situation = str(situation_data)
                round_output_parts.append(f"第{round_num}轮情况：{situation}")
            
            # 获取轮次事件
            if round_num in self.round_events:
                event_data = self.round_events[round_num]
                # round_events存储的是事件对象，可能包含description等字段
                if isinstance(event_data, dict):
                    event_desc = event_data.get('description', '') or str(event_data)
                else:
                    event_desc = str(event_data)
                round_output_parts.append(f"事件：{event_desc}")
            
            # 添加该轮的玩家行动
            if round_num in self.round_actions:
                actions = self.round_actions[round_num]
                action_summary = "\n".join([f"{action.get('player')}({action.get('role', '')})：{action.get('action', '')}" for action in actions])
                round_output_parts.append(f"玩家决策：\n{action_summary}")
            
            if round_output_parts:
                round_outputs.append("\n".join(round_output_parts))
            else:
                round_outputs.append(f"第{round_num}轮：暂无数据")
        
        # 填充prompt4模板
        prompt = prompt4_template.replace("{initial_idea}", combined_ideas)
        prompt = prompt.replace("{output1}", round_outputs[0] if len(round_outputs) > 0 else "暂无数据")
        prompt = prompt.replace("{output2}", round_outputs[1] if len(round_outputs) > 1 else "暂无数据")
        prompt = prompt.replace("{output3}", round_outputs[2] if len(round_outputs) > 2 else "暂无数据")
        prompt = prompt.replace("{output4}", round_outputs[3] if len(round_outputs) > 3 else "暂无数据")
        prompt = prompt.replace("{output5}", round_outputs[4] if len(round_outputs) > 4 else "暂无数据")
        
        # 替换玩家姓名占位符
        # 首先替换CEO的姓名
        ceo_player = None
        for player in self.players:
            if player.role == Role.CEO:
                ceo_player = player
                break
        
        if ceo_player:
            # 替换CEO部分的[玩家姓名]
            prompt = prompt.replace("CEO/Founder：[玩家姓名]", f"CEO/Founder：{ceo_player.name}")
        
        # 替换其他角色的玩家姓名
        role_mapping = {Role.CTO: "CTO", Role.CMO: "CMO", Role.COO: "COO"}
        for player in self.players:
            if player.role and player.role in role_mapping:
                role_name = role_mapping[player.role]
                prompt = prompt.replace(f"{role_name}：[玩家姓名]", f"{role_name}：{player.name}")
        
        try:
            final_report = LLM().text(prompt, temperature=0.7)
            return final_report
        except Exception as e:
            raise Exception(f"生成最终报告失败: {str(e)}")

    def restart_game(self):
        """重新开始游戏，重置游戏状态但保留玩家"""
        # 重置游戏状态
        self.game_state = GameState.LOBBY
        self.current_round = 1
        self.background = None
        self.dynamic_roles = None  # 重置动态角色定义，重新开始时会重新生成
        self.game_result = None
        self.round_actions = {}
        self.round_events = {}  # 重置轮次事件
        self.round_private_messages = {}  # 重置私人信息
        self.dynamic_round_info = {}  # 重置动态轮次信息

        # 重置玩家的游戏相关状态，但保留玩家名称和房主状态
        for player in self.players:
            player.role = None
            player.actions = []
            # 保留 startup_idea，这样玩家不需要重新输入创业想法
