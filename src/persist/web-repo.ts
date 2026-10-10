import type { BoardMeta } from '../kernel/types'
import {
  buildMeta,
  emptyDocument,
  guessMime,
  type AssetPayload,
  type BoardDocument,
  type BoardRepository,
  type PickedImage,
} from './repository'

const DB_NAME = 'whiteboard-storage'
const DB_VERSION = 1
const STORE_META = 'meta'
const STORE_DOCS = 'docs'
const STORE_ASSETS = 'assets'
const THUMB_PREFIX = 'wb.thumb.'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_DOCS)) db.createObjectStore(STORE_DOCS)
      if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'))
  })
  return dbPromise
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (objectStore: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const request = fn(tx.objectStore(store))
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失败'))
      }),
  )
}

function id(): string {
  return `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** 缩略图体积较大，单独放在 localStorage 之外的键上（IndexedDB meta 中只存引用） */
function thumbKey(boardId: string): string {
  return `${THUMB_PREFIX}${boardId}`
}

export class WebBoardRepository implements BoardRepository {
  readonly kind = 'web' as const
  readonly label = '浏览器本地存储'

  async list(): Promise<BoardMeta[]> {
    const metas = (await run<BoardMeta[]>(STORE_META, 'readonly', (store) => store.getAll())) ?? []
    const thumbs = await this.readAllThumbs()
    return metas
      .map((meta) => ({ ...meta, thumbnail: thumbs.get(meta.id), storage: 'local' as const }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async load(boardId: string): Promise<BoardDocument | null> {
    const doc = await run<BoardDocument | undefined>(STORE_DOCS, 'readonly', (store) => store.get(boardId))
    return doc ?? null
  }

  async save(doc: BoardDocument, thumbnail?: string | null): Promise<void> {
    const meta = buildMeta({ ...doc, updatedAt: Date.now() }, 'local', thumbnail)
    await run(STORE_DOCS, 'readwrite', (store) => store.put({ ...doc, updatedAt: meta.updatedAt }, doc.id))
    await run(STORE_META, 'readwrite', (store) => store.put(meta))
    if (thumbnail !== undefined) {
      if (thumbnail) {
        try {
          localStorage.setItem(thumbKey(doc.id), thumbnail)
        } catch {
          console.warn('缩略图缓存写入失败（存储配额可能已满）')
        }
      } else {
        localStorage.removeItem(thumbKey(doc.id))
      }
    }
  }

  async create(name: string): Promise<BoardDocument> {
    const doc = emptyDocument(id(), name)
    await this.save(doc, null)
    return doc
  }

  async duplicate(source: BoardDocument, name: string): Promise<BoardDocument> {
    const now = Date.now()
    const doc: BoardDocument = {
      id: id(),
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
    await run(STORE_DOCS, 'readwrite', (store) => store.delete(boardId))
    await run(STORE_META, 'readwrite', (store) => store.delete(boardId))
    await this.deleteAssets(boardId)
    localStorage.removeItem(thumbKey(boardId))
  }

  async rename(boardId: string, name: string): Promise<void> {
    const meta = await run<BoardMeta | undefined>(STORE_META, 'readonly', (store) => store.get(boardId))
    if (!meta) return
    await run(STORE_META, 'readwrite', (store) => store.put({ ...meta, name, updatedAt: Date.now() }))
    const doc = await this.load(boardId)
    if (doc) await run(STORE_DOCS, 'readwrite', (store) => store.put({ ...doc, name }, boardId))
  }

  async writeAsset(boardId: string, assetId: string, bytes: Uint8Array, mime: string): Promise<void> {
    const payload: AssetPayload = { bytes: bytes.slice(), mime }
    await run(STORE_ASSETS, 'readwrite', (store) => store.put(payload, `${boardId}/${assetId}`))
  }

  async readAsset(boardId: string, assetId: string): Promise<AssetPayload | null> {
    const payload = await run<AssetPayload | undefined>(STORE_ASSETS, 'readonly', (store) =>
      store.get(`${boardId}/${assetId}`),
    )
    return payload ?? null
  }

  async pickImages(): Promise<PickedImage[]> {
    const files = await pickFiles('image/*', true)
    const result: PickedImage[] = []
    for (const file of files) {
      result.push({ name: file.name, mime: file.type || guessMime(file.name), bytes: new Uint8Array(await file.arrayBuffer()) })
    }
    return result
  }

  async pickDocument(): Promise<BoardDocument | null> {
    const files = await pickFiles('.json,application/json', false)
    if (files.length === 0) return null
    const text = await files[0].text()
    const parsed = JSON.parse(text) as Partial<BoardDocument>
    if (!Array.isArray(parsed.records)) throw new Error('场景文件格式不正确')
    const now = Date.now()
    return {
      id: id(),
      name: parsed.name || '导入的白板',
      createdAt: now,
      updatedAt: now,
      camera: parsed.camera ?? null,
      records: parsed.records,
    }
  }

  async saveFile(suggestedName: string, bytes: Uint8Array, mime: string): Promise<string | null> {
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = suggestedName
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return suggestedName
  }

  private async readAllThumbs(): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key?.startsWith(THUMB_PREFIX)) continue
      const value = localStorage.getItem(key)
      if (value) map.set(key.slice(THUMB_PREFIX.length), value)
    }
    return map
  }

  /** 删除某块白板的全部图片资源 */
  private async deleteAssets(boardId: string): Promise<void> {
    const keys = await run<IDBValidKey[]>(STORE_ASSETS, 'readonly', (store) => store.getAllKeys())
    const targets = (keys ?? []).filter((key) => String(key).startsWith(`${boardId}/`))
    for (const key of targets) {
      await run(STORE_ASSETS, 'readwrite', (store) => store.delete(key))
    }
  }
}

function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    document.body.appendChild(input)
    input.addEventListener('change', () => {
      const files = input.files ? Array.from(input.files) : []
      input.remove()
      resolve(files)
    })
    input.addEventListener('cancel', () => {
      input.remove()
      resolve([])
    })
    input.click()
  })
}
