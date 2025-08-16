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
