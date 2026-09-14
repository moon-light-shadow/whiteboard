import { Scene } from './scene'
import type { ChangeSet, RecordId, SceneRecord } from './types'

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string
  redoLabel: string
  index: number
  total: number
}

export interface HistoryOptions {
  getSelection: () => RecordId[]
  setSelection: (ids: RecordId[], options?: { silent?: boolean }) => void
}

const LIMIT = 200

/**
 * 撤销 / 重做栈：以变更集为最小单位，拖拽过程合并为一条历史记录。
 */
export class History {
  private undoStack: ChangeSet[] = []
  private redoStack: ChangeSet[] = []
  private listeners = new Set<(state: HistoryState) => void>()
  private options: HistoryOptions
  private scene: Scene
  private pendingLabel: string | null = null

  constructor(scene: Scene, options: HistoryOptions) {
    this.scene = scene
    this.options = options
  }

  get state(): HistoryState {
    const last = this.undoStack[this.undoStack.length - 1]
    const next = this.redoStack[this.redoStack.length - 1]
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoLabel: last ? describeLabel(last.label) : '',
      redoLabel: next ? describeLabel(next.label) : '',
      index: this.undoStack.length,
      total: this.undoStack.length + this.redoStack.length,
    }
  }

  subscribe(listener: (state: HistoryState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 开始一段可合并的操作（例如一次拖拽） */
  begin(label: string): void {
    this.pendingLabel = label
  }

  /** 记录一次变更；label 相同时与栈顶合并（拖拽过程中的连续更新） */
  push(change: ChangeSet, merge = false): void {
    const empty = change.added.length === 0 && change.updated.length === 0 && change.removed.length === 0
    if (empty) return
    const selectionBefore = change.selectionBefore ?? this.options.getSelection()
    const entry: ChangeSet = { ...change, selectionBefore, selectionAfter: change.selectionAfter }

    const top = this.undoStack[this.undoStack.length - 1]
    if (merge && top && top.label === entry.label) {
      const merged: ChangeSet = {
        label: top.label,
        added: top.added.concat(entry.added.filter((r) => !top.added.some((t) => t.id === r.id))),
        updated: mergeUpdated(top.updated, entry.updated),
        removed: top.removed.concat(entry.removed.filter((r) => !top.removed.some((t) => t.id === r.id))),
        selectionBefore: top.selectionBefore,
        selectionAfter: entry.selectionAfter,
      }
      this.undoStack[this.undoStack.length - 1] = merged
    } else {
      this.undoStack.push(entry)
      if (this.undoStack.length > LIMIT) this.undoStack.shift()
    }
    this.redoStack = []
    this.pendingLabel = null
    this.emit()
  }

  /** 补充最后一条记录的「操作后选区」 */
  setLastSelection(ids: RecordId[]): void {
    const top = this.undoStack[this.undoStack.length - 1]
    if (top) top.selectionAfter = ids
  }

  undo(): boolean {
    const change = this.undoStack.pop()
    if (!change) return false
    this.scene.undoChange(change)
    if (change.selectionBefore) this.options.setSelection(change.selectionBefore)
    this.redoStack.push(change)
    this.emit()
    return true
  }

  redo(): boolean {
    const change = this.redoStack.pop()
    if (!change) return false
    this.scene.redoChange(change)
    if (change.selectionAfter) this.options.setSelection(change.selectionAfter)
    this.undoStack.push(change)
    this.emit()
    return true
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.emit()
  }

  private emit(): void {
    const state = this.state
    for (const listener of this.listeners) listener(state)
  }
}

function mergeUpdated(
  base: { before: SceneRecord; after: SceneRecord }[],
  incoming: { before: SceneRecord; after: SceneRecord }[],
): { before: SceneRecord; after: SceneRecord }[] {
  const map = new Map<string, { before: SceneRecord; after: SceneRecord }>()
  for (const item of base) map.set(item.before.id, item)
  for (const item of incoming) {
    const existing = map.get(item.before.id)
    if (existing) {
      existing.after = item.after
    } else {
      map.set(item.before.id, item)
    }
  }
  return [...map.values()]
}

function describeLabel(label: string): string {
  const base = label.replace(/^undo:/, '')
  const map: Record<string, string> = {
    draw: '绘制笔迹',
    erase: '擦除',
    add: '新建',
    'add:note': '新建便签',
    'add:text': '新建文字',
    'add:shape': '新建图形',
    'add:arrow': '新建箭头',
    'add:image': '插入图片',
    update: '修改内容',
    move: '移动',
    transform: '缩放旋转',
    delete: '删除',
    paste: '粘贴',
    duplicate: '再制',
    reorder: '调整层级',
    style: '修改样式',
    text: '编辑文字',
    template: '套用模板',
  }
  return map[base] ?? '操作'
}
