import { recordBounds } from './geometry'
import { hitTestRecord } from './hit-test'
import { encodeZ, decodeZ, redistribute, zAfterTop } from './order'
import { SpatialIndex } from './spatial-index'
import type { ChangeSet, RecordId, RecordPatch, Rect, SceneRecord, SceneSnapshot } from './types'

export type ChangeOrigin = 'user' | 'history' | 'load' | 'remote'
export type SceneListener = (change: ChangeSet, origin: ChangeOrigin) => void

export interface UpdateTarget {
  id: RecordId
  patch: RecordPatch
}

/**
 * 场景：记录集合 + 空间索引 + 层级顺序。
 * 所有修改都通过变更集（ChangeSet）提交，便于接入历史栈、增量重绘与未来的协作同步。
 */
export class Scene {
  private records = new Map<RecordId, SceneRecord>()
  private index = new SpatialIndex()
  private orderedCache: SceneRecord[] | null = null
  private listeners = new Set<SceneListener>()
  private version = 1
  private topZ = encodeZ(0)

  get count(): number {
    return this.records.size
  }

  get dataVersion(): number {
    return this.version
  }

  subscribe(listener: SceneListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get(id: RecordId | null | undefined): SceneRecord | undefined {
    return id ? this.records.get(id) : undefined
  }

  has(id: RecordId): boolean {
    return this.records.has(id)
  }

  /** 全部记录（按层级从底到顶，带缓存） */
  ordered(): SceneRecord[] {
    if (!this.orderedCache) {
      this.orderedCache = [...this.records.values()].sort((a, b) => (a.z < b.z ? -1 : a.z > b.z ? 1 : 0))
    }
    return this.orderedCache
  }

  /** 与矩形相交的候选记录（空间索引快筛） */
  query(rect: Rect): SceneRecord[] {
    const ids = this.index.query(rect)
    const result: SceneRecord[] = []
    for (const id of ids) {
      const record = this.records.get(id)
      if (record) result.push(record)
    }
    return result
  }

  /** 视口内的可见记录（按层级排序，用于渲染裁剪） */
  visible(rect: Rect): SceneRecord[] {
    const ids = this.index.query(rect)
    if (ids.size === 0) return []
    if (ids.size === this.records.size) return this.ordered()
    const result: SceneRecord[] = []
    for (const id of ids) {
      const record = this.records.get(id)
      if (record) result.push(record)
    }
    result.sort((a, b) => (a.z < b.z ? -1 : a.z > b.z ? 1 : 0))
    return result
  }

  /** 最上层被命中的记录 */
  hitTest(point: { x: number; y: number }, tolerance = 6): SceneRecord | null {
    const probe: Rect = { x: point.x - tolerance, y: point.y - tolerance, w: tolerance * 2, h: tolerance * 2 }
    const candidates = this.query(probe)
    let best: SceneRecord | null = null
    for (const record of candidates) {
      if (!hitTestRecord(record, point, tolerance)) continue
      if (!best || record.z > best.z) best = record
    }
    return best
  }

  /** 命中集合（框选用，intersect 相交 / inside 完全包含） */
  hitAll(rect: Rect, mode: 'intersect' | 'inside' = 'intersect'): SceneRecord[] {
    const candidates = this.query(rect)
    const result: SceneRecord[] = []
    for (const record of candidates) {
      const b = recordBounds(record)
      if (mode === 'inside') {
        if (b.x >= rect.x && b.y >= rect.y && b.x + b.w <= rect.x + rect.w && b.y + b.h <= rect.y + rect.h) {
          result.push(record)
        }
      } else if (!(b.x + b.w < rect.x || rect.x + rect.w < b.x || b.y + b.h < rect.y || rect.y + rect.h < b.y)) {
        result.push(record)
      }
    }
    return result
  }

  bounds(ids?: RecordId[]): Rect | null {
    return this.unionBounds(ids)
  }

  /** 含旋转外框的包围盒（导出与适配内容使用） */
  boundsWithRotation(ids?: RecordId[]): Rect | null {
    return this.unionBounds(ids)
  }

  private unionBounds(ids?: RecordId[]): Rect | null {
    const source = ids ? (ids.map((id) => this.records.get(id)).filter(Boolean) as SceneRecord[]) : this.ordered()
    if (source.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const record of source) {
      const b = recordBounds(record)
      if (b.x < minX) minX = b.x
      if (b.y < minY) minY = b.y
      if (b.x + b.w > maxX) maxX = b.x + b.w
      if (b.y + b.h > maxY) maxY = b.y + b.h
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  add(records: SceneRecord[], label = 'add'): ChangeSet {
    let top = this.topZ || encodeZ(0)
    const added: SceneRecord[] = []
    for (const record of records) {
      const z = record.z || zAfterTop(top)
      const value = record.z ? record : { ...record, z }
      top = z > top ? z : top
      this.records.set(value.id, value)
      this.index.insert(value, recordBounds(value))
      added.push(value)
    }
    this.topZ = top
    return this.commit({ label, added, updated: [], removed: [] })
  }

  update(targets: UpdateTarget[], label = 'update'): ChangeSet {
    const updated: { before: SceneRecord; after: SceneRecord }[] = []
    for (const { id, patch } of targets) {
      const before = this.records.get(id)
      if (!before) continue
      const after = {
        ...before,
        ...patch,
        props: patch.props
          ? { ...(before.props as unknown as Record<string, unknown>), ...patch.props }
          : before.props,
        version: before.version + 1,
        updatedAt: Date.now(),
      } as SceneRecord
      this.records.set(id, after)
      this.index.update(after, recordBounds(after))
      if (after.z > this.topZ) this.topZ = after.z
      updated.push({ before, after })
    }
    if (updated.length === 0) return emptyChange(label)
    return this.commit({ label, added: [], updated, removed: [] })
  }

  remove(ids: RecordId[], label = 'delete'): ChangeSet {
    const removed: SceneRecord[] = []
    for (const id of ids) {
      const record = this.records.get(id)
      if (!record) continue
      this.records.delete(id)
      this.index.remove(id)
      removed.push(record)
    }
    if (removed.length === 0) return emptyChange(label)
    return this.commit({ label, added: [], updated: [], removed })
  }

  /** 直接提交外部构造好的变更集（批量增删改，例如橡皮分割笔迹） */
  commitChange(change: ChangeSet): ChangeSet {
    this.mutateByChangeSet(change)
    this.emit(change, 'user')
    return change
  }

  /** 撤销：应用变更集的逆操作，并广播「实际发生的变更」 */
  undoChange(change: ChangeSet): void {
    const inverse = invertChangeSet(change)
    this.mutateByChangeSet(inverse)
    this.emit(inverse, 'history')
  }

  /** 重做：正向重放变更集 */
  redoChange(change: ChangeSet): void {
    this.mutateByChangeSet(change)
    this.emit(change, 'history')
  }

  /** 调整层级顺序 */
  reorder(ids: RecordId[], mode: 'front' | 'back' | 'forward' | 'backward'): ChangeSet {
    const selected = new Set(ids.filter((id) => this.records.has(id)))
    if (selected.size === 0) return emptyChange('reorder')
    const sorted = this.ordered()
    const moving = sorted.filter((record) => selected.has(record.id))
    const rest = sorted.filter((record) => !selected.has(record.id))

    let next: SceneRecord[]
    if (mode === 'front') {
      next = [...rest, ...moving]
    } else if (mode === 'back') {
      next = [...moving, ...rest]
    } else {
      const arr = [...sorted]
      const step = mode === 'forward' ? 1 : -1
      const order = mode === 'forward' ? [...moving].reverse() : moving
      for (const record of order) {
        const from = arr.findIndex((r) => r.id === record.id)
        const to = from + step
        if (to < 0 || to >= arr.length) continue
        if (selected.has(arr[to].id)) continue
        arr.splice(from, 1)
        arr.splice(to, 0, record)
      }
      next = arr
    }

    const zValues = redistribute(next.length)
    const targets: UpdateTarget[] = next.map((record, i) => ({ id: record.id, patch: { z: zValues[i] } }))
    this.topZ = zValues[zValues.length - 1] ?? this.topZ
    return this.update(targets, 'reorder')
  }

  /** 全量加载（打开白板、套用模板、导入文件） */
  load(records: SceneRecord[]): void {
    this.records.clear()
    this.index.clear()
    this.orderedCache = null
    let top = encodeZ(0)
    for (const record of records) {
      const z = record.z || zAfterTop(top)
      const value = record.z ? record : { ...record, z }
      if (z > top) top = z
      this.records.set(value.id, value)
      this.index.insert(value, recordBounds(value))
    }
    this.topZ = top
    this.version += 1
    this.emit({ label: 'load', added: [...this.records.values()], updated: [], removed: [] }, 'load')
  }

  clear(): void {
    this.load([])
  }

  snapshot(camera?: { x: number; y: number; z: number }): SceneSnapshot {
    return { version: this.version, records: this.ordered(), camera, updatedAt: Date.now() }
  }

  private mutateByChangeSet(change: ChangeSet): void {
    for (const record of change.added) {
      this.records.set(record.id, record)
      this.index.insert(record, recordBounds(record))
      if (record.z > this.topZ) this.topZ = record.z
    }
    for (const { after } of change.updated) {
      this.records.set(after.id, after)
      this.index.update(after, recordBounds(after))
    }
    for (const record of change.removed) {
      this.records.delete(record.id)
      this.index.remove(record.id)
    }
    this.orderedCache = null
    this.version += 1
  }

  private commit(change: ChangeSet): ChangeSet {
    if (change.added.length === 0 && change.updated.length === 0 && change.removed.length === 0) {
      return change
    }
    this.orderedCache = null
    this.version += 1
    this.emit(change, 'user')
    return change
  }

  private emit(change: ChangeSet, origin: ChangeOrigin): void {
    for (const listener of this.listeners) listener(change, origin)
  }
}

function emptyChange(label: string): ChangeSet {
  return { label, added: [], updated: [], removed: [] }
}

/** 反转变更集：撤销时使用 */
export function invertChangeSet(change: ChangeSet): ChangeSet {
  return {
    label: `undo:${change.label}`,
    added: change.removed,
    updated: change.updated.map(({ before, after }) => ({ before: after, after: before })),
    removed: change.added,
    selectionBefore: change.selectionAfter,
    selectionAfter: change.selectionBefore,
  }
}

export function isUserChange(origin: ChangeOrigin): boolean {
  return origin === 'user'
}

export function changeSetSize(change: ChangeSet): number {
  return change.added.length + change.updated.length + change.removed.length
}

export { decodeZ }
