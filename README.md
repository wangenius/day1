# 🚀 创业模拟器 - 多人在线商业策略游戏

一个基于 AI 驱动的多人在线创业模拟游戏，让玩家体验真实的商业决策过程。通过智能生成的商业场景和实时互动，为用户提供沉浸式的创业学习体验。

## ✨ 核心特性

- 🎮 **多人实时对战** - 支持多名玩家同时在线，实时决策竞争
- 🤖 **AI 智能生成** - 动态生成游戏背景、商业事件和角色设定
- 📊 **数据驱动决策** - 基于真实商业逻辑的决策系统
- 🎯 **角色扮演** - CEO、CTO、CMO、COO、CPO 等多种角色选择
- 📈 **实时反馈** - 即时查看决策结果和市场反应

## 🏗️ 技术架构

本项目采用现代化的前后端分离架构，确保高性能和可扩展性。

 🎯 后端技术栈

**核心框架**

- **FastAPI** - 高性能异步 Web 框架，提供 RESTful API
- **WebSocket** - 实现实时双向通信，支持多人在线互动
- **Uvicorn** - ASGI 服务器，高并发处理能力

**AI 智能引擎**

- **OpenAI API** - 集成大语言模型（kimi-k2）
- **PPIO API** - 稳定的 AI 服务代理
- **智能内容生成** - 动态生成游戏场景、事件和报告

**数据存储**

- **内存存储** - 游戏状态和玩家数据存储在内存中
- **文件输出** - 游戏结果和日志保存到本地文件

**网络通信**

- **CORS** - 跨域资源共享支持
- **WebSocket** - 实时双向通信协议

### 🎨 前端技术栈

**现代化框架**

- **React 19.1.0** - 最新版本的前端框架
- **Vite** - 极速构建工具和开发服务器

**样式与交互**

- **Tailwind CSS 4.1.11** - 原子化 CSS 框架
- **PostCSS** - CSS 后处理优化
- **自定义动画** - 丰富的交互动效

## 🚀 快速开始

### 环境要求

- Python 3.8+
- Node.js 16+

### 安装步骤

1. **克隆项目**

   ```bash
   git clone <repository-url>
   cd startup
   ```

2. **后端设置**

   ```bash
   pip install -r requirements.txt
   cp .env.example .env
   # 配置环境变量
   python main.py
   ```

3. **前端设置**
   ```bash
   cd client
   npm install
   npm run dev
   ```

## 🛠️ 开发指南

### 开发环境配置

**1. 环境变量配置**

复制 `.env.example` 文件并重命名为 `.env`，配置以下关键参数：

```bash
# AI 服务配置
PPIO_API_KEY=your_ppio_api_key
PPIO_BASE_URL=your_ppio_base_url

# 应用配置
DEBUG=True
```

**注意：** 本项目使用内存存储，无需配置数据库。游戏数据在服务重启后会重置。

### 开发流程

**启动开发服务器**

1. **后端服务**（端口 8000）

   ```bash
   # 在项目根目录
   python main.py
   ```

2. **前端服务**（端口 5173）

   ```bash
   cd client
   npm run dev
   ```

3. **访问应用**
   - 前端：http://localhost:5173
   - 后端 API：http://localhost:8000

### 项目结构详解

```
├── server/                 # 后端服务
│   ├── app.py             # FastAPI 应用入口
│   ├── websocket_handler.py # WebSocket 处理
│   ├── game_handler.py    # 游戏逻辑处理
│   ├── room_manager.py    # 房间管理
│   ├── llm.py            # AI 模型集成
│   └── prompt/           # AI 提示词模板
├── client/                # 前端应用
│   ├── src/
│   │   ├── components/   # React 组件
│   │   ├── page/        # 页面组件
│   │   └── App.jsx      # 主应用组件
│   └── public/          # 静态资源
└── outputs/             # 游戏输出文件
```

### 开发调试

**后端调试**

```bash
# 启用详细日志
export LOG_LEVEL=DEBUG
python app.py

# 使用 uvicorn 热重载
uvicorn server.app:app --reload --host 0.0.0.0 --port 8000
```

**前端调试**

```bash
# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

**WebSocket 调试**

使用浏览器开发者工具的网络面板监控 WebSocket 连接，或使用专门的 WebSocket 测试工具。

### 代码规范

**Python 代码规范**

```bash
# 安装开发依赖
pip install black flake8 isort

# 代码格式化
black server/
isort server/

# 代码检查
flake8 server/
```

**JavaScript 代码规范**

```bash
# ESLint 检查
npm run lint

# 自动修复
npm run lint:fix
```

### 常见问题

**Q: WebSocket 连接失败**
A: 检查后端服务是否正常运行，确认端口 8000 未被占用

**Q: AI 响应异常**
A: 验证 `.env` 文件中的 PPIO_API_KEY 和 PPIO_BASE_URL 配置是否正确

**Q: 前端页面空白**
A: 检查浏览器控制台错误信息，确认 API 接口可访问

**Q: 游戏数据丢失**
A: 本项目使用内存存储，服务重启后游戏数据会重置，这是正常现象

## 📁 项目结构

```
├── client/          # React 前端应用
├── server/          # FastAPI 后端服务
├── outputs/         # 游戏输出文件
├── requirements.txt # Python 依赖
└── main.py         # 应用入口
```

## 🎮 游戏玩法

1. **选择角色** - 从 CEO、CTO、CMO 等角色中选择
2. **加入房间** - 创建或加入多人游戏房间
3. **商业决策** - 根据 AI 生成的场景做出战略决策
4. **实时竞争** - 与其他玩家实时互动和竞争
5. **查看结果** - 获得详细的决策分析和游戏报告

## 🤝 致谢

感谢 **PPIO** 提供稳定的 AI 服务支持  
感谢 **Advx** 在项目开发中的技术指导

---

_让创业不再是梦想，而是可以体验的游戏！_ 🎯
