import { create } from 'zustand'
import type { HistoryState } from '../kernel/history'
import type { RecordId } from '../kernel/types'

export interface EditingTarget {
  id: RecordId
  /** 进入编辑时是否全选内容 */
  selectAll: boolean
  /** 请求把光标放到末尾 */
  caretToEnd: boolean
  /** 是否为新创建对象（取消时直接删除） */
  isNew: boolean
}

export interface BoardState {
  boardId: string | null
  boardName: string
  selection: RecordId[]
  editing: EditingTarget | null
  dirty: boolean
  saving: boolean
  lastSavedAt: number | null
  history: HistoryState
  /** 画布尺寸变化计数，供覆盖层重新定位 */
  cameraVersion: number
  setBoard: (id: string | null, name: string) => void
  renameBoard: (name: string) => void
  setSelection: (ids: RecordId[]) => void
  addToSelection: (ids: RecordId[]) => void
  toggleSelection: (id: RecordId) => void
  clearSelection: () => void
  startEditing: (target: EditingTarget) => void
  stopEditing: () => void
  setDirty: (dirty: boolean) => void
  setSaving: (saving: boolean) => void
  setLastSavedAt: (time: number | null) => void
  setHistory: (state: HistoryState) => void
  bumpCamera: () => void
}

const EMPTY_HISTORY: HistoryState = {
  canUndo: false,
  canRedo: false,
  undoLabel: '',
  redoLabel: '',
  index: 0,
  total: 0,
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boardId: null,
  boardName: '未命名白板',
  selection: [],
  editing: null,
  dirty: false,
  saving: false,
  lastSavedAt: null,
  history: EMPTY_HISTORY,
  cameraVersion: 0,
  setBoard: (id, name) =>
    set({
      boardId: id,
      boardName: name,
      selection: [],
      editing: null,
      dirty: false,
      lastSavedAt: null,
      history: EMPTY_HISTORY,
    }),
  renameBoard: (name) => set({ boardName: name, dirty: true }),
  setSelection: (ids) => {
    const current = get().selection
    if (current.length === ids.length && current.every((id, i) => id === ids[i])) return
    set({ selection: ids })
  },
  addToSelection: (ids) => {
    const merged = new Set(get().selection)
    ids.forEach((id) => merged.add(id))
    set({ selection: [...merged] })
  },
  toggleSelection: (id) => {
    const current = get().selection
    set({ selection: current.includes(id) ? current.filter((item) => item !== id) : [...current, id] })
  },
  clearSelection: () => {
    if (get().selection.length === 0) return
    set({ selection: [] })
  },
  startEditing: (target) => set({ editing: target }),
  stopEditing: () => set({ editing: null }),
  setDirty: (dirty) => set({ dirty }),
  setSaving: (saving) => set({ saving }),
  setLastSavedAt: (time) => set({ lastSavedAt: time, dirty: false }),
  setHistory: (state) => set({ history: state }),
  bumpCamera: () => set({ cameraVersion: get().cameraVersion + 1 }),
}))
