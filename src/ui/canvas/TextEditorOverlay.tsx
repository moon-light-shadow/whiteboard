import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { layoutText } from '../../kernel/text-layout'
import { NOTE_PADDING, NOTE_RADIUS } from '../../kernel/renderer/draw-note'
import { measureTextRecord } from '../../kernel/renderer/draw-text'
import type { NoteRecord, SceneRecord, TextRecord } from '../../kernel/types'
import { useBoardStore } from '../../store/board-store'
import { useEngine } from './engine-context'

const FONT_STACK = 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
const NOTE_MIN_HEIGHT = 72

function snapshot(record: SceneRecord): SceneRecord {
  return JSON.parse(JSON.stringify(record)) as SceneRecord
}

function noteWorldHeight(text: string, note: NoteRecord): number {
  const layout = layoutText(text, {
    fontSize: note.props.fontSize,
    maxWidth: Math.max(8, note.w - NOTE_PADDING * 2),
    lineHeight: 1.42,
  })
  return Math.max(NOTE_MIN_HEIGHT, Math.round(layout.height + NOTE_PADDING * 2))
}

/** 便签/文字的世界坐标 DOM 编辑层：画布只负责渲染，输入交给 textarea */
export function TextEditorOverlay() {
  const engine = useEngine()
  const editing = useBoardStore((state) => state.editing)
  const cameraVersion = useBoardStore((state) => state.cameraVersion)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const valueRef = useRef('')
  const originalRef = useRef<SceneRecord | null>(null)
  const finishingRef = useRef(false)
  const [value, setValue] = useState('')
  const [height, setHeight] = useState(0)

  const record = editing ? engine.scene.get(editing.id) : undefined
  const recordId = editing?.id ?? null
  const isNew = editing?.isNew ?? false

  void cameraVersion

  const commit = useCallback(() => {
    const id = recordId
    const original = originalRef.current
    if (!id || !original || finishingRef.current) return
    finishingRef.current = true
    const text = valueRef.current
    const current = engine.scene.get(id)

    if (current) {
      if (isNew && text.trim().length === 0) {
        engine.commit(engine.scene.remove([id], 'delete'))
      } else {
        engine.scene.update([{ id, patch: buildPatch(current, text) }], 'edit')
        const after = engine.scene.get(id)
        if (after) engine.commit({ label: 'edit', added: [], updated: [{ before: original, after }], removed: [] })
      }
    }

    originalRef.current = null
    useBoardStore.getState().stopEditing()
    engine.requestRender()
  }, [engine, recordId, isNew])

  useEffect(() => {
    if (!editing) return
    const target = engine.scene.get(editing.id)
    if (!target) return
    originalRef.current = snapshot(target)
    const initial = target.type === 'note' || target.type === 'text' ? target.props.text : ''
    valueRef.current = initial
    setValue(initial)
    setHeight(target.h)
    finishingRef.current = false
  }, [engine, editing])

  useEffect(() => {
    if (!editing) return
    const apply = () => {
      const node = textareaRef.current
      if (!node) return
      node.focus()
      if (editing.selectAll) node.select()
      else if (editing.caretToEnd) node.setSelectionRange(node.value.length, node.value.length)
    }
    apply()
    // pointerdown 的默认行为（焦点回到画布）晚于本次渲染，补一次异步聚焦才能拿到光标
    const raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [editing])

  useEffect(() => () => commit(), [commit])

  if (!editing || !record || (record.type !== 'note' && record.type !== 'text')) return null

  const camera = engine.cameraState
  const rect = engine.renderer.rectToScreen(
    { x: record.x, y: record.y, w: record.w, h: height || record.h },
    camera,
  )
  const fontSize = record.props.fontSize * camera.z
  const isNote = record.type === 'note'
  const lineHeight = isNote ? Math.round(fontSize * 1.42) : record.props.lineHeight * camera.z

  const handleChange = (next: string) => {
    valueRef.current = next
    setValue(next)
    if (isNote) setHeight(noteWorldHeight(next, record as NoteRecord))
  }

  const finish = () => {
    commit()
    engine.setTool('select')
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      finish()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey && !isNote) {
      event.preventDefault()
      finish()
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40" style={{ fontFamily: FONT_STACK }}>
      <div
        className="pointer-events-auto absolute"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          ...(isNote
            ? {
                background: (record as NoteRecord).props.color,
                borderRadius: NOTE_RADIUS * camera.z,
                border: `1px solid ${engine.isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'}`,
                boxShadow: engine.isDark() ? '0 4px 14px rgba(0,0,0,0.55)' : '0 4px 14px rgba(15,23,42,0.18)',
              }
            : undefined),
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          spellCheck={false}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={finish}
          className="wb-scroll h-full w-full resize-none border-0 bg-transparent outline-none"
          style={{
            padding: isNote ? NOTE_PADDING * camera.z : 0,
            color: isNote ? (record as NoteRecord).props.textColor : (record as TextRecord).props.color,
            fontSize,
            lineHeight: `${lineHeight}px`,
            fontWeight: isNote ? 500 : (record as TextRecord).props.bold ? 600 : 400,
            textAlign: isNote ? 'left' : (record as TextRecord).props.align,
            caretColor: isNote ? (record as NoteRecord).props.textColor : (record as TextRecord).props.color,
            fontFamily: FONT_STACK,
          }}
        />
      </div>
    </div>
  )
}

/** 编辑提交时写回记录的补丁：文本 + 自适应尺寸 */
function buildPatch(record: SceneRecord, text: string): Record<string, unknown> {
  // 文本必须写进 props：记录级字段不参与渲染，之前写成顶层 text 会被渲染器忽略
  const props = { text }
  if (record.type === 'note') {
    return { props, h: noteWorldHeight(text, record as NoteRecord) }
  }
  const textRecord = record as TextRecord
  const size = measureTextRecord({ ...textRecord, props: { ...textRecord.props, text } })
  return { props, w: size.w, h: size.h }
}
