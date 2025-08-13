import { ReactNode, MouseEventHandler } from "react";

/**
 * 按钮组件属性
 */
interface ButtonProps {
  /** 点击事件处理函数 */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** 是否禁用 */
  disabled?: boolean;
  /** 子内容 */
  children: ReactNode;
}

/**
 * 自定义按钮组件
 * 具有特定样式和背景图片的按钮
 */
export function Button({ onClick, disabled, children }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-48 h-16 bg-cover bg-no-repeat flex items-center justify-center text-white text-lg font-normal font-['Cactus_Classical_Serif'] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
      style={{
        backgroundImage: 'url("./button.png")',
        backgroundPosition: "50% -20%",
      }}
    >
      {children}
    </button>
  );
}
