import { recordBounds, unionRects } from '../../kernel/geometry'
import { newId } from '../../kernel/factories'
import type { Point, RecordId, SceneRecord } from '../../kernel/types'
import { getRepository } from '../../persist'
import { clampScale, recordsForScope, resolveBounds } from '../../export/bounds'
import { copyCanvasToClipboard } from '../../export/clipboard'
import { renderRecordsToCanvas } from '../../export/raster'
import { useBoardStore } from '../../store/board-store'
import type { ToolStyle } from '../../store/tool-store'
import type { BoardEngine } from './board-engine'

/** 应用内剪贴板：保存记录的深拷贝，粘贴时重生成 id 与层级 */
let clipboard: SceneRecord[] = []

function deepCopy(record: SceneRecord): SceneRecord {
  return JSON.parse(JSON.stringify(record)) as SceneRecord
}

export function hasClipboard(): boolean {
  return clipboard.length > 0
}

export function clearClipboard(): void {
  clipboard = []
}

function cloneForPlacement(records: SceneRecord[], delta: Point): SceneRecord[] {
  const now = Date.now()
  return records.map((record) => {
    const copy = deepCopy(record)
    copy.id = newId(record.type.slice(0, 3))
    copy.x = record.x + delta.x
    copy.y = record.y + delta.y
    copy.z = ''
    copy.version = 1
    copy.updatedAt = now
    return copy
  })
}

export function undo(engine: BoardEngine): void {
  if (!engine.history.undo()) return
  useBoardStore.getState().stopEditing()
  engine.requestRender()
}

export function redo(engine: BoardEngine): void {
  if (!engine.history.redo()) return
  useBoardStore.getState().stopEditing()
  engine.requestRender()
}

export function selectAll(engine: BoardEngine): void {
  engine.setSelection(engine.scene.ordered().map((record) => record.id))
}

export function clearSelection(engine: BoardEngine): void {
  engine.setSelection([])
}

export function deleteSelection(engine: BoardEngine): void {
  const ids = engine.getSelection()
  if (ids.length === 0) return
  engine.commit(engine.scene.remove(ids, 'delete'))
  useBoardStore.getState().stopEditing()
  engine.setSelection([])
}

export function duplicateSelection(engine: BoardEngine): void {
  const ids = engine.getSelection()
  if (ids.length === 0) return
  const originals = ids.map((id) => engine.scene.get(id)).filter((record): record is SceneRecord => Boolean(record))
  if (originals.length === 0) return
  const copies = cloneForPlacement(originals, { x: 24, y: 24 })
  engine.commit(engine.scene.add(copies, 'duplicate'))
  engine.setSelection(copies.map((record) => record.id))
}

export function copySelection(engine: BoardEngine): void {
  const ids = engine.getSelection()
  if (ids.length === 0) return
  clipboard = ids
    .map((id) => engine.scene.get(id))
    .filter((record): record is SceneRecord => Boolean(record))
    .map(deepCopy)
  engine.showToast(`已复制 ${clipboard.length} 个对象`, 'success')
}

export function cutSelection(engine: BoardEngine): void {
  if (engine.getSelection().length === 0) return
  copySelection(engine)
  deleteSelection(engine)
}

/** 粘贴；传入世界坐标时以该点为中心放置，否则相对原位置偏移 */
export function pasteClipboard(engine: BoardEngine, at?: Point): boolean {
  if (clipboard.length === 0) return false
  const copies = clipboard.map(deepCopy)
  let delta: Point = { x: 24, y: 24 }
  if (at) {
    const bounds = unionRects(copies.map((record) => recordBounds(record)))
    if (bounds) delta = { x: at.x - (bounds.x + bounds.w / 2), y: at.y - (bounds.y + bounds.h / 2) }
  }
  const placed = cloneForPlacement(copies, delta)
  engine.commit(engine.scene.add(placed, 'paste'))
  engine.setSelection(placed.map((record) => record.id))
  return true
}

export function nudgeSelection(engine: BoardEngine, dx: number, dy: number): void {
  const ids = engine.getSelection()
  if (ids.length === 0) return
  const targets = ids.map((id) => {
    const record = engine.scene.get(id)
    return record ? { id, patch: { x: record.x + dx, y: record.y + dy } } : null
  })
  const valid = targets.filter((target): target is { id: RecordId; patch: { x: number; y: number } } => Boolean(target))
  if (valid.length === 0) return
  engine.commit(engine.scene.update(valid, 'move'), { merge: true })
}

export function reorderSelection(engine: BoardEngine, mode: 'front' | 'back' | 'forward' | 'backward'): void {
  const ids = engine.getSelection()
  if (ids.length === 0) return
  engine.commit(engine.scene.reorder(ids, mode))
}

/** 把当前工具的样式应用到选中对象（仅选择工具下有选区时使用） */
export function applyStyleToSelection(engine: BoardEngine, style: ToolStyle): void {
  const ids = engine.getSelection()
  if (ids.length === 0) return
  const targets = ids
    .map((id) => engine.scene.get(id))
    .map((record) => (record ? stylePatchFor(record, style) : null))
    .filter((target): target is { id: RecordId; patch: { props: Record<string, unknown> } } => Boolean(target))
  if (targets.length === 0) return
  engine.commit(engine.scene.update(targets, 'style'))
}

function stylePatchFor(
  record: SceneRecord,
  style: ToolStyle,
): { id: RecordId; patch: { props: Record<string, unknown> } } | null {
  switch (record.type) {
    case 'ink':
      return record.props.style === 'highlighter'
        ? { id: record.id, patch: { props: { color: style.highlighterColor, size: style.highlighterSize, opacity: 0.34 } } }
        : { id: record.id, patch: { props: { color: style.penColor, size: style.penSize, opacity: 1 } } }
    case 'note':
      return {
        id: record.id,
        patch: { props: { color: style.noteColor, textColor: style.noteTextColor, fontSize: style.noteFontSize } },
      }
    case 'text':
      return {
        id: record.id,
        patch: { props: { color: style.textColor, fontSize: style.textFontSize, bold: style.textBold } },
      }
    case 'image':
      return null
    case 'line':
    case 'arrow':
      return {
        id: record.id,
        patch: { props: { stroke: style.shapeStroke, size: style.lineSize, dash: style.lineDashed ? [4, 4] : null } },
      }
    default:
      return {
        id: record.id,
        patch: {
          props: {
            stroke: style.shapeStroke,
            fill: style.shapeFill,
            size: style.shapeSize,
            dash: style.shapeDashed ? [4, 4] : null,
          },
        },
      }
  }
}

/** 把选区（或整板）导出为图片并写入剪贴板 */
export async function copySelectionAsImage(engine: BoardEngine): Promise<void> {
  const selection = engine.getSelection()
  const records = recordsForScope(engine.scene, selection, selection.length > 0 ? 'selection' : 'board')
  if (records.length === 0) {
    engine.showToast('画布为空，没有可复制的内容')
    return
  }
  const bounds = resolveBounds(records)
  const { canvas } = renderRecordsToCanvas(records, bounds, clampScale(bounds, 2), {
    isDark: engine.isDark(),
    variant: 'plain',
  })
  const ok = await copyCanvasToClipboard(canvas)
  engine.showToast(ok ? '已复制为图片' : '当前环境不支持写入剪贴板', ok ? 'success' : 'error')
}

/** 导入场景文件并替换当前白板内容（可撤销） */
export async function importSceneIntoBoard(engine: BoardEngine): Promise<void> {
  const doc = await getRepository().pickDocument()
  if (!doc) return
  engine.loadRecords(doc.records, 'update')
  engine.showToast(`已导入「${doc.name}」`, 'success')
}
