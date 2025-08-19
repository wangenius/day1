import type { ServerConfig } from "../../const/const";

/**
 * 获取服务器配置
 * 根据当前环境（开发/生产）返回相应的服务器地址配置
 * @returns 包含http和ws地址的配置对象
 */
export const getServerConfig = (): ServerConfig => {
  // 判断是否为开发环境
  const isDev = import.meta.env.DEV;
  // 从环境变量获取主机地址
  const envHost = import.meta.env.VITE_SERVER_HOST as string | undefined;
  // 从环境变量获取端口，默认8000
  const envPort = (import.meta.env.VITE_SERVER_PORT as string) || "8000";

  if (isDev) {
    // 开发环境：如果设置了环境变量主机地址
    if (envHost) {
      return { host: envHost, port: envPort, http: "", ws: "" };
    }

    // 获取当前页面的主机名
    const currentHost = window.location.hostname;
    // 本地开发环境
    if (currentHost === "localhost" || currentHost === "127.0.0.1") {
      return { http: `http://localhost:8000`, ws: `ws://localhost:8000/ws` };
    }

    // 其他开发环境（如局域网IP）
    return {
      http: `http://${currentHost}:8000`,
      ws: `ws://${currentHost}:8000/ws`,
    };
  }

  // 生产环境：使用相对路径
  return { http: `/api`, ws: `/api` };
};
