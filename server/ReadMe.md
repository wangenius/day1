结构：

// Room 管理
class Room {
id
players: Record<string,Players>
create
game: Game
status: "lobby" | "gaming" | "result"
}


class Player {
// 链接
connection: Connection
}

class Game {
// 阶段
phase:
...
}


# 游戏阶段

## 用户登陆
1. 前端用户输入用户名提交。
2. 用户登陆后，进入大厅。 可以创建房间或者加入房间。

## 创建/加入房间
1. 创建或者加入房间后, 进入房间，websocket正式连接。 room实例下，连接对应的player。
2. 期间可以输入自己的idea， 确认准备后，等待房主开始游戏。

## 开始游戏
1. 房主开始游戏后
2. 中途不能加入玩家

## 结束游戏
1. 游戏结束后，房间状态切换到完成。