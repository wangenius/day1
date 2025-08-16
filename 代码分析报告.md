# 创业游戏后端代码架构分析

## 整体架构设计

这是一个基于WebSocket的多人在线创业模拟游戏，采用三层架构设计：

### 核心类关系
```
Room (房间管理) 
  ├── Player[] (玩家管理)
  └── Game (游戏逻辑)
      └── GameInfo (游戏状态数据)
```

## 1. Room.ts - 房间管理核心

### 类职责
- **房间生命周期管理**：创建、销毁、清理空房间
- **玩家连接管理**：处理玩家加入、离开、重连
- **消息通信**：WebSocket消息广播和单点发送
- **游戏状态检查**：验证游戏开始条件

### 关键方法详解

#### 静态方法（房间工厂）
```typescript
// 房间创建工厂方法
static create(id: string): Room
// 限制最多10个房间，防止资源耗尽

// 房间获取方法
static get(id: string): Room | null
// 从静态房间字典中获取房间实例

// 玩家加入房间
static join(player_id: string, id: string): Room
// 自动创建Player实例并加入房间

// 房间清理机制
static cleanup(): void
// 定期清理无在线玩家的空房间
```

#### 实例方法（房间操作）
```typescript
// 消息广播系统
async broadcast(message: any, exclude_player?: string): Promise<number>
// 向房间内所有在线玩家发送消息，支持排除特定玩家
// 返回实际发送成功的玩家数量

// 玩家管理
add_player(player: Player): boolean
// 检查房间状态、人数限制、设置房主权限

// 游戏状态检查
all_players_have_ideas(): boolean
all_players_have_roles(): boolean
// 检查是否满足游戏开始条件
```

### 设计模式应用
- **工厂模式**：静态方法创建和管理房间实例
- **单例管理**：通过静态字典确保房间ID唯一性
- **观察者模式**：消息广播机制

## 2. Player.ts - 玩家连接处理

### 类职责
- **WebSocket连接生命周期管理**
- **消息路由和事件处理**
- **玩家状态同步**
- **错误处理和资源清理**

### 核心流程分析

#### 连接建立流程
```typescript
static async connect(ws: WebSocket): Promise<void>
```

**步骤详解：**
1. **初始化等待** (`_waitForInit`)
   - 等待客户端发送初始化数据：`{player_name, room_id}`
   - 设置超时和错误处理机制

2. **房间验证和玩家处理** (`_upsertPlayer`)
   - 验证房间是否存在
   - 处理新玩家加入或已有玩家重连
   - 自动设置房主权限（第一个加入的玩家）

3. **Socket绑定** (`_bindSocket`)
   - 将WebSocket实例绑定到Player对象
   - 建立双向通信通道

4. **状态同步**
   - 广播玩家加入消息
   - 发送完整的游戏状态给新连接的玩家

#### 消息路由系统
```typescript
const router: Record<string, (payload: any) => Promise<void>> = {
  startup_idea: async (payload) => room.game.handle_startup_idea(player_name, payload?.idea),
  start_game: async () => room.game.handle_start_game(player_name),
  select_role: async (payload) => room.game.handle_role_selection(player_name, payload?.role),
  game_action: async (payload) => room.game.handle_game_action(player_name, payload),
  restart_game: async () => room.game.handle_restart_game(player_name),
  leave_room: async (payload) => { /* 处理主动退出 */ }
};
```

**路由设计特点：**
- 基于消息类型的动态路由
- 异步处理避免阻塞
- 统一的错误处理机制
- 权限控制（如只有房主能开始游戏）

#### 连接断开处理
```typescript
ws.on("close", async () => {
  // 1. 查找玩家所在房间
  // 2. 标记玩家为离线（而非删除）
  // 3. 通知其他玩家
  // 4. 清理空房间
  // 5. 解绑Socket连接
});
```

### 重连机制设计
- **软离线**：连接断开时只标记`is_online = false`，保留玩家数据
- **重连恢复**：重连时发送完整游戏状态，确保状态同步
- **区分处理**：新连接广播给所有人，重连只通知其他玩家

## 3. Game.ts - 游戏逻辑核心

### 类职责
- **游戏流程控制**：5轮游戏的完整生命周期
- **AI内容生成**：集成LLM生成动态游戏内容
- **计时和超时管理**：自动推进游戏进程
- **结果计算**：评分系统和成就生成

### 游戏状态机

#### 游戏阶段
```typescript
enum GameState {
  PLAYING = "playing",
  FINISHED = "finished"
}

enum RoomState {
  PREPARE = "prepare",    // 准备阶段：玩家加入、选择角色
  PLAYING = "playing"     // 游戏阶段：5轮事件处理
}
```

#### 轮次状态
```typescript
interface RoundInfo {
  situation: string;                    // 当前轮次情况描述
  decision_options: Record<string, string>; // 决策选项
  private_messages: Record<string, string>; // 角色私密信息
  player_actions: Record<string, string>;   // 玩家选择记录
  phase_remain: number;                     // 剩余时间（秒）
}
```

### AI内容生成系统

#### 1. 背景故事生成
```typescript
async generateBackgroundFromIdeas(playerIdeas: string[]): Promise<string>
```
- **输入**：所有玩家的创业想法
- **处理**：使用Prompt模板P1，结合玩家信息
- **输出**：统一的背景故事，为后续事件提供上下文

#### 2. 动态事件生成
```typescript
async generateEvent(round_num: number): Promise<GeneratedEvent>
```
- **上下文构建**：`_buildPreviousExperience()` 整理历史决策
- **智能生成**：基于背景、轮次、历史经验生成新事件
- **结构验证**：`_validateEventResponse()` 确保生成内容完整性
- **容错处理**：3次重试机制，失败时返回默认结构

#### 3. 轮次分析
```typescript
async generateRoundAnalysis(current_round: number): Promise<string>
```
- **影响分析**：分析上一轮玩家决策的后果
- **故事连贯性**：确保游戏叙事的逻辑连续性
- **个性化内容**：根据不同角色的选择生成定制化分析

### 计时和超时管理

#### 多层计时器设计
```typescript
// 轮次超时管理
private static _round_timeout_tasks: Map<string, NodeJS.Timeout> = new Map();
// 实时计时更新
private static _round_tick_tasks: Map<string, NodeJS.Timeout> = new Map();
```

#### 阶段转换调度
```typescript
private _schedulePhaseTransitions(expected_round: number): void {
  // 10秒后：事件展示 -> 信息和选项阶段
  setTimeout(() => { /* 切换到信息阶段 */ }, 10000);
  
  // 30秒后：信息和选项 -> 讨论阶段
  setTimeout(() => { /* 切换到讨论阶段 */ }, 30000);
  
  // 启动实时计时器
  this._startRoundTick();
}
```

#### 超时自动处理
```typescript
private async _autoSubmitMissingPlayers(round_num: number, reason: string): Promise<void>
```
- **公平性保证**：超时后为未提交玩家随机选择
- **游戏连续性**：避免因个别玩家掉线导致游戏卡死
- **行为记录**：记录自动提交的原因（超时/阶段结束）

### 结果计算系统

#### 评分算法
```typescript
async calculateGameResult(): Promise<GameResult>
```

**评分维度：**
- **基础分**：50分起始分数
- **参与度**：每次行动+2分（最多+50分）
- **随机因子**：模拟市场不确定性
- **成功等级**：根据总分划分成就等级

**成就系统：**
- 90+分：🦄独角兽公司
- 75+分：📈成功IPO
- 60+分：💼盈利稳定
- 45+分：🎯产品上线

#### 个人表现分析
```typescript
private _calculatePlayerPerformance(): Array<Record<string, any>>
```
- **参与度统计**：统计每位玩家的行动次数
- **贡献分计算**：行动次数 × 10分（最高50分）
- **角色表现**：结合角色特性的个性化评价

### 资源管理和清理

#### 内存泄漏防护
```typescript
cleanupRoom(): void {
  // 清理实时计时器
  const tick = Game._round_tick_tasks.get(this.room.id);
  if (tick) clearInterval(tick);
  
  // 清理超时任务
  for (const [key, timeout] of Array.from(Game._round_timeout_tasks.entries())) {
    if (key.startsWith(`${this.room.id}:`)) {
      clearTimeout(timeout);
      Game._round_timeout_tasks.delete(key);
    }
  }
}
```

#### 任务键值设计
```typescript
private _taskKey(roomId: string, round: number): string {
  return `${roomId}:${round}`;
}
```
- **唯一性保证**：房间ID + 轮次号确保任务唯一性
- **批量清理**：支持按房间ID前缀批量清理任务
- **避免冲突**：不同房间的相同轮次不会互相干扰

## 系统特点总结

### 1. 高可靠性
- **多层容错**：网络断线、AI生成失败、玩家掉线都有对应处理
- **状态恢复**：支持玩家重连后完整状态同步
- **资源管理**：完善的定时器和内存清理机制

### 2. 高扩展性
- **模块化设计**：Room、Player、Game职责清晰分离
- **消息路由**：基于类型的动态消息处理系统
- **AI集成**：可插拔的LLM内容生成系统

### 3. 用户体验
- **实时反馈**：秒级计时器更新和状态同步
- **智能超时**：自动处理掉线玩家，确保游戏流畅
- **个性化内容**：基于玩家选择的动态故事生成

### 4. 技术亮点
- **WebSocket长连接**：实现真正的实时多人交互
- **状态机设计**：清晰的游戏阶段控制
- **事件驱动架构**：基于消息的松耦合系统设计
- **AI内容生成**：集成大语言模型的动态游戏内容

这个架构设计充分考虑了多人在线游戏的复杂性，通过合理的分层和模块化，实现了一个功能完整、可靠稳定的创业模拟游戏后端系统。
