import { useState, useEffect } from "react";
import { useGame } from "../../context/GameContextCore";
import RoleList from "./RoleList";
import { ROLES } from "../../const/roles";

/**
 * 角色选择组件
 * 玩家选择游戏角色的页面
 */
function RoleSelection() {
  const { players, playerName, handleRoleSelect, selectedRoles } = useGame();

  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  /**
   * 处理角色选择
   * @param roleId - 角色ID
   */
  const handleRoleSelectClick = (roleId: string): void => {
    // 更严格的前端检查
    const roleIdLower = roleId.toLowerCase();
    
    // 检查角色是否已被选择
    if (selectedRoles.includes(roleIdLower)) {
      console.warn(`角色 ${roleId} 已被其他玩家选择`);
      return;
    }
    
    // 检查当前玩家是否已经选择过角色
    if (selectedRole || currentPlayer?.role) {
      console.warn(`玩家已经选择过角色: ${selectedRole || currentPlayer?.role}`);
      return;
    }

    // 设置本地状态并发送请求
    setSelectedRole(roleId);
    handleRoleSelect(roleId);
  };

  const currentPlayer = players.find((p) => p.name === playerName);
  const hasSelectedRole = currentPlayer?.role || selectedRole;

  // 监听玩家状态变化，如果服务器确认了角色选择，清除本地临时状态
  useEffect(() => {
    if (currentPlayer?.role && selectedRole) {
      // 服务器已确认角色选择，清除本地临时状态
      setSelectedRole(null);
    }
  }, [currentPlayer?.role, selectedRole]);

  return (
    <div className="min-h-screen w-full bg-stone-950 overflow-hidden flex flex-col p-4">
      <div className="text-center text-white text-xl font-normal font-['Cactus_Classical_Serif'] leading-relaxed py-8">
        选择角色
      </div>

      {/* 角色选择区域 */}
      <RoleList
        roles={ROLES}
        selectedRole={selectedRole}
        currentPlayerRole={currentPlayer?.role}
        selectedRoles={selectedRoles}
        hasSelectedRole={!!hasSelectedRole}
        onRoleSelect={handleRoleSelectClick}
      />
    </div>
  );
}

export default RoleSelection;
