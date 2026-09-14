import type { Camera } from '../camera'
import type { ArrowRecord, ShapeRecord } from '../types'
import { applyDash, roundRectPath, withRecordTransform } from './draw-common'

const RADIUS_RATIO = 0.18

export function buildShapePath(record: ShapeRecord): Path2D {
  const w = Math.max(record.w, 0.01)
  const h = Math.max(record.h, 0.01)
  const path = new Path2D()
  switch (record.type) {
    case 'ellipse':
      path.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      break
    case 'triangle':
      path.moveTo(w / 2, 0)
      path.lineTo(w, h)
      path.lineTo(0, h)
      path.closePath()
      break
    case 'diamond':
      path.moveTo(w / 2, 0)
      path.lineTo(w, h / 2)
      path.lineTo(w / 2, h)
      path.lineTo(0, h / 2)
      path.closePath()
      break
    case 'roundedRect':
      roundRectPath(path, 0, 0, w, h, Math.min(w, h) * RADIUS_RATIO)
      break
    default:
      path.rect(0, 0, w, h)
      break
  }
  return path
}

export function drawShape(ctx: CanvasRenderingContext2D, record: ShapeRecord): void {
  const props = record.props
  withRecordTransform(ctx, record, () => {
    const path = buildShapePath(record)
    if (props.fill && props.fill !== 'transparent') {
      ctx.fillStyle = props.fill
      ctx.fill(path)
    }
    if (props.size > 0) {
      ctx.strokeStyle = props.stroke
      ctx.lineWidth = props.size
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      applyDash(ctx, props.dash, props.size)
      ctx.stroke(path)
      ctx.setLineDash([])
    }
  })
}

/** 箭头/直线的端点（局部坐标） */
export function arrowEndpoints(record: ArrowRecord): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const { n1x, n1y, n2x, n2y } = record.props
  return {
    a: { x: n1x * record.w, y: n1y * record.h },
    b: { x: n2x * record.w, y: n2y * record.h },
  }
}

/** 箭头头部尺寸：宽度与长度都随线宽放大，粗线时头部才不会被线身吞掉 */
function headGeometry(size: number): { length: number; width: number } {
  return {
    length: Math.max(size * 4.2, 11),
    width: Math.max(size * 3.4, 8.5),
  }
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  tip: { x: number; y: number },
  from: { x: number; y: number },
  size: number,
  color: string,
): void {
  const { length, width } = headGeometry(size)
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  ctx.save()
  ctx.translate(tip.x, tip.y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-length, width / 2)
  ctx.lineTo(-length * 0.76, 0)
  ctx.lineTo(-length, -width / 2)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  // 描边让头部与线身自然衔接，消除"圆柱 + 三角"的割裂感
  ctx.lineWidth = Math.max(size * 0.5, 1)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export function drawArrow(ctx: CanvasRenderingContext2D, record: ArrowRecord, _camera: Camera): void {
  const props = record.props
  withRecordTransform(ctx, record, () => {
    const { a, b } = arrowEndpoints(record)
    const total = Math.hypot(b.x - a.x, b.y - a.y)
    if (total < 0.01) return

    const hasTipHead = record.type === 'arrow'
    const hasTailHead = Boolean(props.double)
    // 线身收进箭头根部（凹口位置），圆头笔帽便不会再越过头部露出"圆柱"
    const inset = Math.min(headGeometry(props.size).length * 0.76, total * 0.42)
    const ux = (b.x - a.x) / total
    const uy = (b.y - a.y) / total
    const from = hasTailHead ? { x: a.x + ux * inset, y: a.y + uy * inset } : a
    const to = hasTipHead ? { x: b.x - ux * inset, y: b.y - uy * inset } : b

    ctx.strokeStyle = props.stroke
    ctx.lineWidth = props.size
    ctx.lineCap = 'round'
    if (props.dash) applyDash(ctx, props.dash, props.size)
    if (Math.hypot(to.x - from.x, to.y - from.y) > 0.01) {
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
    ctx.setLineDash([])
    if (hasTipHead) {
      drawHead(ctx, b, a, props.size, props.stroke)
    }
    if (hasTailHead) {
      drawHead(ctx, a, b, props.size, props.stroke)
    }
  })
}
