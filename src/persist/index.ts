import { revokeAllObjectUrls, toObjectUrl, type BoardRepository } from './repository'
import { TauriBoardRepository } from './tauri-repo'
import { WebBoardRepository } from './web-repo'

export * from './repository'

let cached: BoardRepository | null = null

/** 当前是否运行在 Tauri 桌面壳内 */
export function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  const scope = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
  return Boolean(scope.__TAURI_INTERNALS__ || scope.__TAURI__)
}

/** 自动选择持久化实现：桌面优先落盘，浏览器回退 IndexedDB 便于预览验证 */
export function getRepository(): BoardRepository {
  if (!cached) cached = isTauriEnv() ? new TauriBoardRepository() : new WebBoardRepository()
  return cached
}

/** 读取图片资源并转为可直接渲染的对象 URL */
export async function loadAssetUrl(repo: BoardRepository, boardId: string, assetId: string): Promise<string | null> {
  const asset = await repo.readAsset(boardId, assetId)
  if (!asset) return null
  return toObjectUrl(asset.bytes, asset.mime)
}

export { revokeAllObjectUrls }
