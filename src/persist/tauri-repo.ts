import { invoke } from '@tauri-apps/api/core'
import type { BoardMeta } from '../kernel/types'
import { isMobileEnv } from './env'
import { base64ToBytes, bytesToBase64 } from './base64'
import {
  buildMeta,
  emptyDocument,
  guessMime,
  type AssetPayload,
  type BoardDocument,
  type BoardRepository,
  type PickedImage,
} from './repository'

interface RawAsset {
  data: string
  mime: string
}

function newId(): string {
  return `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Tauri 文件实现：白板数据写入应用数据目录
 * `boards/<id>/board.json`（记录）+ `meta.json`（列表元数据）+ `assets/`（图片）。
 * 由 Rust 侧保证「先写临时文件再改名」的原子语义与损坏回退。
 */
export class TauriBoardRepository implements BoardRepository {
  readonly kind = 'tauri' as const
  readonly label = '本机目录'

  async list(): Promise<BoardMeta[]> {
    const metas = await invoke<BoardMeta[]>('list_boards')
    return metas.map((meta) => ({ ...meta, storage: 'local' as const })).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async load(boardId: string): Promise<BoardDocument | null> {
    const raw = await invoke<string | null>('read_board', { id: boardId })
    if (!raw) return null
    const parsed = JSON.parse(raw) as BoardDocument
    if (!Array.isArray(parsed.records)) return null
    return parsed
  }

  async save(doc: BoardDocument, thumbnail?: string | null): Promise<void> {
    const next: BoardDocument = { ...doc, updatedAt: Date.now() }
    const meta = buildMeta(next, 'local', thumbnail)
    await invoke('write_board', {
      id: doc.id,
      data: JSON.stringify(next),
      meta: JSON.stringify({ ...meta, thumbnail: thumbnail ?? null }),
    })
  }

  async create(name: string): Promise<BoardDocument> {
    const doc = emptyDocument(newId(), name)
    await this.save(doc, null)
    return doc
  }

  async duplicate(source: BoardDocument, name: string): Promise<BoardDocument> {
    const now = Date.now()
    const doc: BoardDocument = {
      id: newId(),
      name,
      createdAt: now,
      updatedAt: now,
      camera: source.camera,
      records: JSON.parse(JSON.stringify(source.records)),
    }
    await this.save(doc, null)
    for (const record of doc.records) {
      if (record.type !== 'image') continue
      const asset = await this.readAsset(source.id, record.props.assetId)
      if (asset) await this.writeAsset(doc.id, record.props.assetId, asset.bytes, asset.mime)
    }
    return doc
  }

  async remove(boardId: string): Promise<void> {
    await invoke('delete_board', { id: boardId })
  }

  async rename(boardId: string, name: string): Promise<void> {
    const doc = await this.load(boardId)
    if (!doc) return
    await this.save({ ...doc, name }, await this.readThumbnail(boardId))
  }

  async writeAsset(boardId: string, assetId: string, bytes: Uint8Array, mime: string): Promise<void> {
    await invoke('write_asset', { id: boardId, assetId, mime, data: bytesToBase64(bytes) })
  }

  async readAsset(boardId: string, assetId: string): Promise<AssetPayload | null> {
    const raw = await invoke<RawAsset | null>('read_asset', { id: boardId, assetId })
    if (!raw) return null
    return { bytes: base64ToBytes(raw.data), mime: raw.mime }
  }

  async pickImages(): Promise<PickedImage[]> {
    const paths = await invoke<string[] | null>('pick_image_files')
    if (!paths || paths.length === 0) return []
    const result: PickedImage[] = []
    for (const path of paths) {
      const data = await invoke<string>('read_file_base64', { path })
      const name = path.split(/[\\/]/).pop() ?? 'image.png'
      result.push({ name, mime: guessMime(name), bytes: base64ToBytes(data) })
    }
    return result
  }

  async pickDocument(): Promise<BoardDocument | null> {
    const path = await invoke<string | null>('pick_scene_file')
    if (!path) return null
    const text = await invoke<string>('read_file_text', { path })
    const parsed = JSON.parse(text) as Partial<BoardDocument>
    if (!Array.isArray(parsed.records)) throw new Error('场景文件格式不正确')
    const now = Date.now()
    return {
      id: newId(),
      name: parsed.name || '导入的白板',
      createdAt: now,
      updatedAt: now,
      camera: parsed.camera ?? null,
      records: parsed.records,
    }
  }

  async saveFile(
    suggestedName: string,
    bytes: Uint8Array,
    _mime: string,
    description: string,
  ): Promise<string | null> {
    const data = bytesToBase64(bytes)
    // 移动端系统保存框返回 content:// URI，无法直接写：改为写入应用私有目录
    if (isMobileEnv()) {
      return invoke<string>('write_export_file', { name: suggestedName, data })
    }
    const ext = suggestedName.split('.').pop() ?? 'bin'
    const target = await invoke<string | null>('pick_save_path', {
      suggestedName,
      extension: ext,
      description,
    })
    if (!target) return null
    await invoke('write_file_base64', { path: target, data })
    return target
  }

  private async readThumbnail(boardId: string): Promise<string | null> {
    return invoke<string | null>('read_thumbnail', { id: boardId })
  }
}
