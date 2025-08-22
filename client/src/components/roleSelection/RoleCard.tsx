import { RoleCardProps } from "../../types/role";

/**
 * 单个角色卡片组件
 * 负责渲染单个角色的选择卡片，包括选中状态和交互逻辑
 */
function RoleCard({
  role,
  isSelected,
  isOccupied,
  hasSelectedRole,
  onRoleSelect,
}: RoleCardProps) {
  /**
   * 处理角色点击
   */
  const handleClick = () => {
    if (!isOccupied && !hasSelectedRole) {
      onRoleSelect(role);
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* 选中状态的背景高亮 */}
      {isSelected && (
        <div className="absolute inset-0 bg-yellow-400/20 rounded-lg animate-pulse -z-10" />
      )}

      <div className="relative w-full">
        <img
          className={`w-full h-auto object-contain cursor-pointer transition-all duration-300 rounded-lg ${
            isOccupied
              ? "opacity-30"
              : isSelected
              ? "ring-4 ring-yellow-400 ring-opacity-80 shadow-lg shadow-yellow-400/50 brightness-110"
              : "hover:brightness-110 hover:shadow-md"
          }`}
          src={`/${role}.png`}
          alt={role}
          onClick={handleClick}
        />

        {/* 选中状态的勾选标记 */}
        {isSelected && (
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center z-20 animate-bounce">
            <svg
              className="w-5 h-5 text-black"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoleCard;
