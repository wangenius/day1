# 游戏上下文模块化结构

这个目录包含了重构后的游戏上下文管理系统，将原来的巨大 `GameContext.tsx` 文件拆分为多个功能模块。

## 文件结构

```
context/
├── README.md                    # 本文档
├── GameContext.tsx             # 主入口文件，导出重构后的组件
├── GameContextCore.ts          # 核心类型定义和 useGame Hook
├── GameProvider.tsx            # 主 Provider 组件，组合所有模块
├── hooks/                      # 功能模块 Hooks
│   ├── useGameState.ts         # 状态管理
│   ├── useWebSocket.ts         # WebSocket 连接管理
│   ├── useGameAPI.ts           # HTTP API 调用
│   └── useGameHandlers.ts      # 事件处理器
└── utils/                      # 工具函数
    ├── serverConfig.ts         # 服务器配置
    └── audioManager.ts         # 背景音乐管理
```

## 模块说明

### 核心文件

- **`GameContext.tsx`**: 主入口文件，保持向后兼容性
- **`GameContextCore.ts`**: 包含 Context 类型定义和 `useGame` Hook
- **`GameProvider.tsx`**: 新的主 Provider 组件，组合所有功能模块

### 功能模块 (hooks/)

#### `useGameState.ts` - 状态管理
- 管理所有游戏状态（玩家、房间、轮次等）
- 提供状态更新函数
- 包含数据规范化和本地存储工具

#### `useWebSocket.ts` - WebSocket 管理
- 处理 WebSocket 连接建立和关闭
- 处理所有来自服务器的消息
- 管理重连逻辑

#### `useGameAPI.ts` - API 调用
- 处理 HTTP API 请求
- 房间列表获取
- 房间创建/加入

#### `useGameHandlers.ts` - 事件处理
- 所有用户交互事件处理
- 游戏阶段控制
- WebSocket 消息发送

### 工具模块 (utils/)

#### `serverConfig.ts` - 服务器配置
- 根据环境配置服务器地址
- 开发/生产环境自动切换

#### `audioManager.ts` - 音频管理
- 背景音乐播放控制
- 自动播放策略处理

## 重构优势

1. **代码可维护性**: 从 1144 行拆分为多个小文件
2. **职责分离**: 每个模块负责单一功能
3. **类型安全**: 更好的 TypeScript 类型支持
4. **代码复用**: 各模块可独立测试和复用
5. **向后兼容**: 保持原有 API 不变

## 使用方式

使用方式保持不变：

```tsx
import { GameProvider, useGame } from "./context/GameContext";

function App() {
  return (
    <GameProvider>
      <YourComponents />
    </GameProvider>
  );
}

function SomeComponent() {
  const { gameState, players, handleRoleSelect } = useGame();
  // ... 组件逻辑
}
```

## 开发指南

1. **添加新状态**: 在 `useGameState.ts` 中添加
2. **添加新API**: 在 `useGameAPI.ts` 中添加
3. **添加新事件处理**: 在 `useGameHandlers.ts` 中添加
4. **添加新WebSocket消息**: 在 `useWebSocket.ts` 中添加
5. **更新类型**: 在 `GameContextCore.ts` 中更新接口

## 注意事项

- 所有状态管理逻辑都在 GameContext 中，遵循规则：「所有与游戏状态和后端业务相关的，放到 GameContext 中去实现。」
- 各模块通过参数传递依赖，保持解耦
- WebSocket 和 API 调用都通过 Context 暴露给组件使用
