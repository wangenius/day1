import { useState, useEffect } from "react";
import { useGameState } from "../../context/StateContext";
import RoleCard from "./RoleCard";
import { RoleEnum } from "@/const/types";

/**
 * 角色选择组件
 * 玩家选择游戏角色的页面
 */
function RoleSelection() {
  const { room, game } = useGameState();

  const [selectedRole, setSelectedRole] = useState<string | null>(
    game.state.roles[room.player]
  );

  /**
   * 处理角色选择
   * @param roleId - 角色ID
   */
  const handleRoleSelectClick = (roleId: string): void => {
    // 更严格的前端检查 - 使用原始角色ID，因为后端现在返回大写值
    // 检查角色是否已被选择
    if (game.state.roles[roleId]) {
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

      <div className="flex-1 flex flex-col justify-center space-y-6 max-w-md mx-auto w-full">
        {["CEO", "CMO", "CTO", "COO"].map((role) => {
          const isSelected =
            selectedRole === role || game.state.roles[room.player] === role;
          const isOccupied =
            Object.values(game.state.roles).includes(role as RoleEnum) &&
            !isSelected;

          return (
            <RoleCard
              key={role}
              role={role}
              isSelected={isSelected}
              isOccupied={isOccupied}
              hasSelectedRole={!!hasSelectedRole}
              onRoleSelect={handleRoleSelectClick}
            />
          );
        })}
      </div>
    </div>
  );
}

export default RoleSelection;
