import { layoutText } from '../text-layout'
import type { NoteRecord } from '../types'
import { roundRectPath, withRecordTransform } from './draw-common'

export const NOTE_PADDING = 14
export const NOTE_RADIUS = 12

export function noteTextArea(record: NoteRecord): { width: number; height: number; layout: ReturnType<typeof layoutText> } {
  const width = Math.max(8, record.w - NOTE_PADDING * 2)
  const layout = layoutText(record.props.text, {
    fontSize: record.props.fontSize,
    maxWidth: width,
    lineHeight: 1.42,
  })
  return { width, height: record.h - NOTE_PADDING * 2, layout }
}

/** 绘制定宽便签：底色 + 文本（超出部分裁剪） */
export function drawNote(ctx: CanvasRenderingContext2D, record: NoteRecord, isDark: boolean): void {
  const props = record.props
  const { width, height, layout } = noteTextArea(record)
  withRecordTransform(ctx, record, () => {
    const path = new Path2D()
    roundRectPath(path, 0, 0, Math.max(record.w, 0.01), Math.max(record.h, 0.01), NOTE_RADIUS)

    ctx.save()
    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(15, 23, 42, 0.18)'
    ctx.shadowBlur = 14
    ctx.shadowOffsetY = 4
    ctx.fillStyle = props.color
    ctx.fill(path)
    ctx.restore()

    ctx.save()
    ctx.clip(path)
    ctx.fillStyle = props.textColor
    ctx.font = `500 ${props.fontSize}px Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
    ctx.textBaseline = 'top'
    const maxLines = Math.max(1, Math.floor(height / layout.lineHeight))
    const lines = layout.lines.slice(0, maxLines)
    if (layout.lines.length > maxLines && lines.length > 0) {
      lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`
    }
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], NOTE_PADDING, NOTE_PADDING + i * layout.lineHeight)
    }
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'
    ctx.lineWidth = 1
    ctx.stroke(path)
    ctx.restore()

    void width
  })
}
