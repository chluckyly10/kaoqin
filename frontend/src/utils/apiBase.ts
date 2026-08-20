/**
 * 后端 API 基址工具
 *
 * - 开发环境：返回空字符串，前端请求走 umi proxy（.umirc.ts 中配置 /api -> localhost:3000）
 * - 生产环境：通过环境变量 UMI_APP_API_BASE 指定后端完整地址（如 https://xxx.onrender.com）
 *
 * 用法：
 *   import { apiBase, getWsUrl } from '@/utils/apiBase';
 *   fetch(`${apiBase}/api/v1/...`)
 *   new WebSocket(getWsUrl('/ws'))
 */

// Umi 4 自动注入以 UMI_APP_ 开头的环境变量
export const apiBase: string = (process.env.UMI_APP_API_BASE as string) || '';

/**
 * 获取 WebSocket URL
 * @param path WebSocket 路径，如 '/ws'
 */
export function getWsUrl(path: string): string {
  if (process.env.UMI_APP_API_BASE) {
    const base = process.env.UMI_APP_API_BASE as string;
    const wsBase = base.replace(/^http/, 'ws');
    return `${wsBase}${path}`;
  }
  // 开发环境：用当前 hostname + 后端端口
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:3000${path}`;
}
