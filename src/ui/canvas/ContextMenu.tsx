import { useEffect, useRef } from 'react'
import { Clipboard, Copy, Edit3, Layers, Scissors, Trash2, Wand2 } from 'lucide-react'
import { MenuItem, MenuSeparator } from '../primitives/Popover'
import { useUiStore } from '../../store/ui-store'
import { useBoardStore } from '../../store/board-store'
import { useEngine } from './engine-context'
import {
  copySelection,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  hasClipboard,
  pasteClipboard,
  reorderSelection,
  selectAll,
} from './engine-commands'

/** 画布与对象右键菜单 */
export function ContextMenu() {
  const engine = useEngine()
  const menu = useUiStore((state) => state.contextMenu)
  const close = useUiStore((state) => state.closeContextMenu)
  const openDialog = useUiStore((state) => state.openDialog)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu, close])

  if (!menu) return null

  const target = menu.targetId ? engine.scene.get(menu.targetId) : undefined
  const editable = target?.type === 'note' || target?.type === 'text'
  const width = 200
  const height = target ? 316 : 168
  const left = Math.min(menu.x, window.innerWidth - width - 12)
  const top = Math.min(menu.y, window.innerHeight - height - 12)

  const run = (action: () => void) => () => {
    action()
    close()
  }

  return (
    <div
      ref={rootRef}
      role="menu"
      className="fixed z-[85] w-[200px] rounded-2xl bg-surface-raised p-1.5 shadow-pop ring-1 ring-surface-border animate-slide-down"
      style={{ left, top }}
    >
      {editable ? (
        <MenuItem onSelect={run(() => useBoardStore.getState().startEditing({ id: menu.targetId as string, selectAll: true, caretToEnd: false, isNew: false }))}>
          <span className="inline-flex items-center gap-2">
            <Edit3 size={14} className="text-content-muted" /> 编辑文字
          </span>
        </MenuItem>
      ) : null}
      {target ? (
        <>
          <MenuItem onSelect={run(() => copySelection(engine))}>
            <span className="inline-flex items-center gap-2">
              <Copy size={14} className="text-content-muted" /> 复制
            </span>
          </MenuItem>
          <MenuItem onSelect={run(() => cutSelection(engine))}>
            <span className="inline-flex items-center gap-2">
              <Scissors size={14} className="text-content-muted" /> 剪切
            </span>
          </MenuItem>
          <MenuItem onSelect={run(() => duplicateSelection(engine))}>
            <span className="inline-flex items-center gap-2">
              <Layers size={14} className="text-content-muted" /> 再制
            </span>
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={run(() => reorderSelection(engine, 'front'))} shortcut="Ctrl+]">
            置于顶层
          </MenuItem>
          <MenuItem onSelect={run(() => reorderSelection(engine, 'back'))} shortcut="Ctrl+[">
            置于底层
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={run(() => deleteSelection(engine))} shortcut="Del">
            <span className="inline-flex items-center gap-2">
              <Trash2 size={14} /> 删除
            </span>
          </MenuItem>
        </>
      ) : (
        <>
          <MenuItem disabled={!hasClipboard()} onSelect={run(() => pasteClipboard(engine, menu.world))} shortcut="Ctrl+V">
            <span className="inline-flex items-center gap-2">
              <Clipboard size={14} className="text-content-muted" /> 粘贴到此处
            </span>
          </MenuItem>
          <MenuItem onSelect={run(() => selectAll(engine))} shortcut="Ctrl+A">
            全选
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={run(() => engine.fitToContent())} shortcut="Shift+1">
            适配内容
          </MenuItem>
          <MenuItem onSelect={run(() => openDialog('export'))} shortcut="Ctrl+E">
            <span className="inline-flex items-center gap-2">
              <Wand2 size={14} className="text-content-muted" /> 导出白板
            </span>
          </MenuItem>
        </>
      )}
    </div>
  )
}
