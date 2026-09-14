import type { BoardMeta, SceneRecord } from '../kernel/types'

export type StorageKind = 'tauri' | 'web'

export interface CameraState {
  x: number
  y: number
  z: number
}

/** 一块白板的完整文档（落盘单位） */
export interface BoardDocument {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  camera: CameraState | null
  records: SceneRecord[]
}

export interface PickedImage {
  name: string
  mime: string
  bytes: Uint8Array
}

export interface AssetPayload {
  bytes: Uint8Array
  mime: string
}

/**
 * 持久化适配器：Tauri 文件系统与浏览器 IndexedDB 共用同一契约。
 * 语义要求：写入必须原子（先写临时文件再改名），读取失败不得污染内存状态。
 */
export interface BoardRepository {
  readonly kind: StorageKind
  readonly label: string
  list(): Promise<BoardMeta[]>
  load(id: string): Promise<BoardDocument | null>
  /** 保存文档与缩略图（缩略图为 data URL，可选） */
  save(doc: BoardDocument, thumbnail?: string | null): Promise<void>
  create(name: string): Promise<BoardDocument>
  duplicate(source: BoardDocument, name: string): Promise<BoardDocument>
  remove(id: string): Promise<void>
  rename(id: string, name: string): Promise<void>
  writeAsset(boardId: string, assetId: string, bytes: Uint8Array, mime: string): Promise<void>
  readAsset(boardId: string, assetId: string): Promise<AssetPayload | null>
  pickImages(): Promise<PickedImage[]>
  pickDocument(): Promise<BoardDocument | null>
  /** 弹出系统保存对话框写文件；返回 false 表示用户取消 */
  saveFile(suggestedName: string, bytes: Uint8Array, mime: string, description: string): Promise<boolean>
}

export const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
}

export const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
}

export function extForMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? 'bin'
}

export function mimeForExt(ext: string): string {
  return EXT_MIME[ext.toLowerCase()] ?? 'application/octet-stream'
}

/** 生成「名称 副本」「名称 副本 2」这类不重复的标题 */
export function uniqueName(base: string, existing: string[]): string {
  const taken = new Set(existing.map((name) => name.trim()))
  if (!taken.has(base)) return base
  const stem = base.replace(/\s+\d+$/, '')
  for (let i = 2; i < 500; i += 1) {
    const candidate = `${stem} ${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base} ${Date.now()}`
}

export function emptyDocument(id: string, name: string): BoardDocument {
  const now = Date.now()
  return { id, name, createdAt: now, updatedAt: now, camera: null, records: [] }
}

export function buildMeta(doc: BoardDocument, storage: BoardMeta['storage'], thumbnail?: string | null): BoardMeta {
  return {
    id: doc.id,
    name: doc.name,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    recordCount: doc.records.length,
    thumbnail: thumbnail ?? undefined,
    storage,
  }
}

/** 把二进制包装为 Blob（规避 TS 对 ArrayBufferLike 的严格约束） */
export function toBlob(bytes: Uint8Array, mime: string): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer as ArrayBuffer], { type: mime })
}

const objectUrls = new Set<string>()

export function toObjectUrl(bytes: Uint8Array, mime: string): string {
  const url = URL.createObjectURL(toBlob(bytes, mime))
  objectUrls.add(url)
  return url
}

export function revokeObjectUrl(url: string): void {
  if (!objectUrls.has(url)) return
  URL.revokeObjectURL(url)
  objectUrls.delete(url)
}

/** 释放本会话创建的全部对象 URL（切换白板/退出时调用） */
export function revokeAllObjectUrls(): void {
  for (const url of objectUrls) URL.revokeObjectURL(url)
  objectUrls.clear()
}

export async function bytesFromFile(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer()
  return new Uint8Array(buffer)
}

export function guessMime(name: string, fallback = 'image/png'): string {
  const ext = name.split('.').pop() ?? ''
  return EXT_MIME[ext.toLowerCase()] ?? fallback
}
