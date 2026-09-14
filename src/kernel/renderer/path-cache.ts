import type { RecordId } from '../types'

interface Entry {
  version: number
  path: Path2D
}

/**
 * Path2D 缓存：按「记录 id + 版本号」缓存已构建的路径，
 * 记录未修改时平移缩放无需重新构建几何（笔迹轮廓构建成本最高）。
 */
export class PathCache {
  private entries = new Map<RecordId, Entry>()

  get(id: RecordId, version: number, build: () => Path2D): Path2D {
    const hit = this.entries.get(id)
    if (hit && hit.version === version) return hit.path
    const path = build()
    this.entries.set(id, { version, path })
    if (this.entries.size > 4000) {
      const first = this.entries.keys().next().value
      if (first) this.entries.delete(first)
    }
    return path
  }

  drop(id: RecordId): void {
    this.entries.delete(id)
  }

  clear(): void {
    this.entries.clear()
  }

  get size(): number {
    return this.entries.size
  }
}
