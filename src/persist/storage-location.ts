import { invoke } from '@tauri-apps/api/core'
import { isMobileEnv, isTauriEnv } from './env'

/** 存储位置快照（与 Rust 侧 `StorageInfo` 对齐） */
export interface StorageInfo {
  /** 当前画布数据目录，各白板位于其 boards 子目录 */
  dataDir: string
  /** 出厂默认目录 */
  defaultDir: string
  /** 是否已显式选择过目录（false = 首次启动） */
  configured: boolean
  /** 当前目录下的白板数量 */
  boardCount: number
}

/** 目录迁移统计 */
export interface MigrationReport {
  copied: number
  skipped: number
  failed: number
}

export interface SetStorageDirResult {
  info: StorageInfo
  migration: MigrationReport | null
}

/** 存储位置设置仅在桌面端可用（浏览器预览走 IndexedDB，移动端固定在应用私有目录） */
export function supportsStorageLocation(): boolean {
  return isTauriEnv() && !isMobileEnv()
}

/** 读取当前存储位置；非桌面环境返回 null */
export async function loadStorageInfo(): Promise<StorageInfo | null> {
  if (!supportsStorageLocation()) return null
  return invoke<StorageInfo>('storage_info')
}

/** 弹出系统目录选择器；返回 null 表示用户取消 */
export async function pickStorageDir(): Promise<string | null> {
  return invoke<string | null>('pick_folder')
}

/** 切换画布目录；migrate 为真时把现有白板复制到新目录 */
export async function applyStorageDir(path: string, migrate: boolean): Promise<SetStorageDirResult> {
  return invoke<SetStorageDirResult>('set_storage_dir', { path, migrate })
}

/** 恢复出厂默认位置 */
export async function resetStorageDir(): Promise<StorageInfo> {
  return invoke<StorageInfo>('reset_storage_dir')
}

/** 用系统文件管理器打开当前画布目录 */
export async function revealStorageDir(): Promise<void> {
  await invoke('open_storage_dir')
}
