import type { Rect, RecordId, SceneRecord } from './types'

const CELL_SIZE = 256

function cellKey(cx: number, cy: number): string {
  return `${cx}:${cy}`
}

function cellRange(r: Rect): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: Math.floor(r.x / CELL_SIZE),
    maxX: Math.floor((r.x + r.w) / CELL_SIZE),
    minY: Math.floor(r.y / CELL_SIZE),
    maxY: Math.floor((r.y + r.h) / CELL_SIZE),
  }
}

/**
 * 均匀网格空间索引：先做包围盒快筛，把命中检测的候选集缩小到常数级别。
 * 单元格 256 世界单位，在普通白板场景下每格仅数条记录。
 */
export class SpatialIndex {
  private cells = new Map<string, Set<RecordId>>()
  private entries = new Map<RecordId, Rect>()
  private count = 0

  get size(): number {
    return this.count
  }

  clear(): void {
    this.cells.clear()
    this.entries.clear()
    this.count = 0
  }

  insert(record: SceneRecord, bounds: Rect): void {
    const existing = this.entries.get(record.id)
    if (existing) this.remove(record.id)
    this.entries.set(record.id, bounds)
    const { minX, maxX, minY, maxY } = cellRange(bounds)
    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const key = cellKey(cx, cy)
        let set = this.cells.get(key)
        if (!set) {
          set = new Set()
          this.cells.set(key, set)
        }
        set.add(record.id)
      }
    }
    this.count += 1
  }

  remove(id: RecordId): void {
    const bounds = this.entries.get(id)
    if (!bounds) return
    const { minX, maxX, minY, maxY } = cellRange(bounds)
    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const key = cellKey(cx, cy)
        const set = this.cells.get(key)
        if (!set) continue
        set.delete(id)
        if (set.size === 0) this.cells.delete(key)
      }
    }
    this.entries.delete(id)
    this.count -= 1
  }

  update(record: SceneRecord, bounds: Rect): void {
    this.insert(record, bounds)
  }

  /** 查询与给定矩形相交（含边界）的候选 id 集合 */
  query(r: Rect): Set<RecordId> {
    const result = new Set<RecordId>()
    const { minX, maxX, minY, maxY } = cellRange(r)
    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const set = this.cells.get(cellKey(cx, cy))
        if (!set) continue
        for (const id of set) result.add(id)
      }
    }
    return result
  }
}
