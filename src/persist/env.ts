/** 当前是否运行在 Tauri 桌面壳内（浏览器预览时为 false） */
export function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  const scope = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
  return Boolean(scope.__TAURI_INTERNALS__ || scope.__TAURI__)
}

/** 是否运行在移动端（Android / iOS）：数据固定存放在应用私有目录，无系统目录选择器 */
export function isMobileEnv(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}
