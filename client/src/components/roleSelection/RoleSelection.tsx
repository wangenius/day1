import { useState, useEffect } from "react";
import { useGameState } from "../../context/StateContext";
import RoleList from "./RoleList";
import { ROLES } from "../../const/roles";

/**
 * 角色选择组件
 * 玩家选择游戏角色的页面
 */
function RoleSelection() {
  const { room, game } = useGameState();

  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // 添加调试日志
  console.log("RoleSelection - players:", room.state.players);
  console.log("RoleSelection - playerName:", room.player);
  console.log("RoleSelection - selectedRoles:", game.state.roles);
  console.log("RoleSelection - selectedRole (local):", selectedRole);

  /**
   * 处理角色选择
   * @param roleId - 角色ID
   */
  const handleRoleSelectClick = (roleId: string): void => {
    console.log("handleRoleSelectClick - 开始执行，角色ID:", roleId);
    console.log("handleRoleSelectClick - selectedRoles:", game.state.roles);
    console.log("handleRoleSelectClick - selectedRole (local):", selectedRole);
    console.log("handleRoleSelectClick - currentPlayer:", currentPlayer);

    // 更严格的前端检查 - 使用原始角色ID，因为后端现在返回大写值

    // 检查角色是否已被选择
    if (Object.keys(game.state.roles).includes(roleId)) {
      console.warn(`角色 ${roleId} 已被其他玩家选择`);
      return;
    }

    // 检查当前玩家是否已经选择过角色
    if (selectedRole || game.state.roles[room.player]) {
      console.warn(
        `玩家已经选择过角色: ${selectedRole || game.state.roles[room.player]}`
      );
      return;
    }

    console.log("handleRoleSelectClick - 设置本地状态并发送请求");
    // 设置本地状态并发送请求
    setSelectedRole(roleId);
    game.handleRoleSelect(roleId);
  };

  const currentPlayer = room.state.players.find((p) => p.name === room.player);
  const hasSelectedRole = game.state.roles[room.player] || selectedRole;

  // 监听玩家状态变化，如果服务器确认了角色选择，清除本地临时状态
  useEffect(() => {
    if (game.state.roles[room.player] && selectedRole) {
      // 服务器已确认角色选择，清除本地临时状态
      setSelectedRole(null);
    }
  }, [game.state.roles[room.player], selectedRole]);

  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden flex flex-col p-4">
      <div className="text-center text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-relaxed py-8">
        选择角色
      </div>

      {/* 角色选择区域 */}
      <RoleList
        roles={ROLES}
        selectedRole={selectedRole}
        currentPlayerRole={game.state.roles[room.player]}
        selectedRoles={Object.keys(game.state.roles)}
        hasSelectedRole={!!hasSelectedRole}
        onRoleSelect={handleRoleSelectClick}
      />
    </div>
  );
}

export default RoleSelection;
