/** 当前是否运行在 Tauri 桌面壳内（浏览器预览时为 false） */
export function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  const scope = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
  return Boolean(scope.__TAURI_INTERNALS__ || scope.__TAURI__)
}
