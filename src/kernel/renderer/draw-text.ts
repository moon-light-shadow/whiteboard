import { layoutText } from '../text-layout'
import type { TextRecord } from '../types'
import { withRecordTransform } from './draw-common'

export function drawText(ctx: CanvasRenderingContext2D, record: TextRecord): void {
  const props = record.props
  const layout = layoutText(props.text, {
    fontSize: props.fontSize,
    bold: props.bold,
    maxWidth: Math.max(8, record.w),
    lineHeight: props.lineHeight,
  })
  withRecordTransform(ctx, record, () => {
    ctx.fillStyle = props.color
    ctx.font = `${props.bold ? '600 ' : '400'} ${props.fontSize}px Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
    ctx.textBaseline = 'top'
    ctx.textAlign = props.align
    const x = props.align === 'center' ? record.w / 2 : props.align === 'right' ? record.w : 0
    for (let i = 0; i < layout.lines.length; i += 1) {
      ctx.fillText(layout.lines[i], x, i * layout.lineHeight)
    }
  })
}

/** 文字记录的自动高度（编辑提交后调用） */
export function measureTextRecord(record: TextRecord): { w: number; h: number } {
  const props = record.props
  const layout = layoutText(props.text, {
    fontSize: props.fontSize,
    bold: props.bold,
    maxWidth: Math.max(8, record.w),
    lineHeight: props.lineHeight,
  })
  return { w: Math.max(record.w, Math.ceil(layout.width) + 2), h: Math.max(layout.lineHeight, layout.height) }
}
