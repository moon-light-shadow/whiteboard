import { revokeAllObjectUrls, toObjectUrl, type BoardRepository } from './repository'
import { TauriBoardRepository } from './tauri-repo'
import { WebBoardRepository } from './web-repo'
import { isTauriEnv } from './env'

export * from './repository'
export * from './env'
export * from './storage-location'

let cached: BoardRepository | null = null

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
