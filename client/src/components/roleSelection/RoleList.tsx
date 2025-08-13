import RoleCard from "./RoleCard";
import { RoleListProps } from "../../types/role";

/**
 * 角色列表组件
 * 负责渲染所有可选择的角色卡片
 */
function RoleList({
  roles,
  selectedRole,
  currentPlayerRole,
  selectedRoles,
  hasSelectedRole,
  onRoleSelect,
}: RoleListProps) {
  return (
    <div className="flex-1 flex flex-col justify-center space-y-6 max-w-md mx-auto w-full">
      {roles.map((role) => {
        const isSelected =
          selectedRole === role.id || currentPlayerRole === role.id;
        const isOccupied =
          selectedRoles.includes(role.id) && !isSelected;

        return (
          <RoleCard
            key={role.id}
            role={role}
            isSelected={isSelected}
            isOccupied={isOccupied}
            hasSelectedRole={hasSelectedRole}
            onRoleSelect={onRoleSelect}
          />
        );
      })}
    </div>
  );
}

export default RoleList;
