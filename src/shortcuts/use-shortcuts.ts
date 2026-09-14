import { useEffect } from 'react'
import { HIGHLIGHTER_SIZE_STEPS, INK_SIZE_STEPS, useToolStore, type ToolId } from '../store/tool-store'
import { useUiStore } from '../store/ui-store'
import { isTypingTarget } from '../tools/tool'
import { useBoardStore } from '../store/board-store'
import {
  copySelection,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  nudgeSelection,
  pasteClipboard,
  redo,
  reorderSelection,
  selectAll,
  undo,
} from '../ui/canvas/engine-commands'
import type { BoardEngine } from '../ui/canvas/board-engine'
import type { ShapeKind } from '../kernel/types'

const TOOL_KEYS: Record<string, string> = {
  v: 'select',
  l: 'lasso',
  p: 'pen',
  h: 'highlighter',
  e: 'eraser',
  n: 'note',
  t: 'text',
  a: 'arrow',
  i: 'image',
}

const SHAPE_KEYS: Record<string, ShapeKind> = {
  r: 'rect',
  o: 'ellipse',
  d: 'diamond',
}

function stepBrush(direction: 1 | -1): void {
  const store = useToolStore.getState()
  const isHighlighter = store.tool === 'highlighter'
  const steps: readonly number[] = isHighlighter ? HIGHLIGHTER_SIZE_STEPS : INK_SIZE_STEPS
  const current = isHighlighter ? store.highlighterSize : store.penSize
  const index = steps.indexOf(current)
  const next = steps[Math.max(0, Math.min(steps.length - 1, (index < 0 ? 2 : index) + direction))]
  if (isHighlighter) store.setStyle({ highlighterSize: next })
  else store.setStyle({ penSize: next })
}

/** 全局快捷键分发：输入态与弹窗打开时自动让路 */
export function useShortcuts(engine: BoardEngine | null): void {
  useEffect(() => {
    if (!engine) return

    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUiStore.getState()
      if (event.key === 'Escape') {
        if (ui.dialog) {
          ui.closeDialog()
          return
        }
        if (ui.contextMenu) {
          ui.closeContextMenu()
          return
        }
      }
      if (isTypingTarget(event.target)) return

      const mod = event.ctrlKey || event.metaKey
      const lower = event.key.toLowerCase()

      if (mod) {
        switch (lower) {
          case 'z':
            event.preventDefault()
            if (event.shiftKey) redo(engine)
            else undo(engine)
            return
          case 'y':
            event.preventDefault()
            redo(engine)
            return
          case 'c':
            event.preventDefault()
            copySelection(engine)
            return
          case 'x':
            event.preventDefault()
            cutSelection(engine)
            return
          case 'v':
            event.preventDefault()
            pasteClipboard(engine)
            return
          case 'd':
            event.preventDefault()
            if (event.shiftKey) ui.toggleTheme()
            else duplicateSelection(engine)
            return
          case 'a':
            event.preventDefault()
            selectAll(engine)
            return
          case 'e':
            event.preventDefault()
            ui.openDialog('export')
            return
          case 's':
            event.preventDefault()
            void engine.saveNow()
            engine.showToast('已保存', 'success')
            return
          case ']':
            event.preventDefault()
            reorderSelection(engine, 'front')
            return
          case '[':
            event.preventDefault()
            reorderSelection(engine, 'back')
            return
          case '=':
          case '+':
            event.preventDefault()
            engine.zoomBy(1.2)
            return
          case '-':
          case '_':
            event.preventDefault()
            engine.zoomBy(1 / 1.2)
            return
          case '0':
            event.preventDefault()
            engine.zoomToPercent(100)
            return
          default:
            return
        }
      }

      if (event.code === 'Space') {
        event.preventDefault()
        engine.setSpaceHeld(true)
        return
      }
      if (event.key === 'Escape') {
        useBoardStore.getState().stopEditing()
        engine.setTool('select')
        engine.setSelection([])
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelection(engine)
        return
      }
      if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
        nudgeSelection(engine, dx / engine.cameraState.z, dy / engine.cameraState.z)
        return
      }
      if (event.shiftKey && event.code === 'Digit1') {
        event.preventDefault()
        engine.fitToContent()
        return
      }
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault()
        ui.openDialog('shortcuts')
        return
      }
      if (event.key === ']') {
        stepBrush(1)
        return
      }
      if (event.key === '[') {
        stepBrush(-1)
        return
      }
      if (event.key === 'f' && import.meta.env.DEV) {
        ui.toggleFps()
        return
      }
      if (SHAPE_KEYS[lower]) {
        useToolStore.getState().setStyle({ shapeKind: SHAPE_KEYS[lower] })
        engine.setTool('shape')
        return
      }
      if (TOOL_KEYS[lower]) {
        engine.setTool(TOOL_KEYS[lower] as ToolId)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') engine.setSpaceHeld(false)
    }
    const onBlur = () => engine.setSpaceHeld(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [engine])
}
