import type { RecordId } from './types'

export type AssetLoader = (assetId: string) => Promise<string | null>

interface Entry {
  url: string
  image: HTMLImageElement | null
  loaded: boolean
  failed: boolean
  promise: Promise<void> | null
}

/**
 * 图片资源缓存：把 assetId 解析为可绘制的 HTMLImageElement。
 * 加载完成后回调通知渲染器重绘（图片可能晚于记录出现）。
 */
class ImageCache {
  private entries = new Map<string, Entry>()
  private loader: AssetLoader | null = null
  private listeners = new Set<() => void>()

  setLoader(loader: AssetLoader | null): void {
    this.loader = loader
  }

  onLoad(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get(assetId: string | undefined): HTMLImageElement | null {
    if (!assetId) return null
    const entry = this.entries.get(assetId)
    if (!entry) {
      void this.ensure(assetId)
      return null
    }
    if (!entry.loaded && !entry.failed) void this.ensure(assetId)
    return entry.image
  }

  url(assetId: string): string | null {
    return this.entries.get(assetId)?.url ?? null
  }

  ensure(assetId: string): Promise<void> {
    const existing = this.entries.get(assetId)
    if (existing) {
      if (existing.promise) return existing.promise
      if (existing.loaded || existing.failed) return Promise.resolve()
    }
    const entry: Entry = existing ?? { url: '', image: null, loaded: false, failed: false, promise: null }
    this.entries.set(assetId, entry)
    entry.promise = this.load(assetId, entry)
    return entry.promise
  }

  private async load(assetId: string, entry: Entry): Promise<void> {
    if (!this.loader) {
      entry.failed = true
      return
    }
    const url = await this.loader(assetId)
    if (!url) {
      entry.failed = true
      entry.promise = null
      this.notify()
      return
    }
    entry.url = url
    await new Promise<void>((resolve) => {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => {
        entry.image = image
        entry.loaded = true
        entry.promise = null
        resolve()
      }
      image.onerror = () => {
        entry.failed = true
        entry.promise = null
        resolve()
      }
      image.src = url
    })
    this.notify()
  }

  /** 注册外部已创建对象的图片（粘贴图片时避免再次读盘） */
  put(assetId: string, image: HTMLImageElement, url: string): void {
    this.entries.set(assetId, { image, url, loaded: true, failed: false, promise: null })
    this.notify()
  }

  storeDataUrl(assetId: string, dataUrl: string): Promise<void> {
    const entry: Entry = { url: dataUrl, image: null, loaded: false, failed: false, promise: null }
    this.entries.set(assetId, entry)
    entry.promise = new Promise<void>((resolve) => {
      const image = new Image()
      image.onload = () => {
        entry.image = image
        entry.loaded = true
        entry.promise = null
        resolve()
      }
      image.onerror = () => {
        entry.failed = true
        entry.promise = null
        resolve()
      }
      image.src = dataUrl
    })
    return entry.promise
  }

  /** 释放某块白板使用的资源 */
  releaseAssetIds(assetIds: RecordId[]): void {
    for (const id of assetIds) {
      const entry = this.entries.get(id)
      if (entry && entry.url.startsWith('blob:')) URL.revokeObjectURL(entry.url)
      this.entries.delete(id)
    }
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      if (entry.url.startsWith('blob:')) URL.revokeObjectURL(entry.url)
    }
    this.entries.clear()
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}

export const imageCache = new ImageCache()
