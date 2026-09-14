import { distToSegment, pointInPolygon, recordCenter, rotatePoint } from './geometry'
import type { Point, SceneRecord } from './types'

/** 把世界坐标点转换到记录的局部坐标系（去旋转、去平移） */
function localPoint(record: SceneRecord, point: Point): Point {
  const c = recordCenter(record)
  const flat = rotatePoint(point, c, -record.rotation)
  return { x: flat.x - record.x, y: flat.y - record.y }
}

function hitInk(record: SceneRecord, point: Point, tolerance: number): boolean {
  const props = record.props as { points: number[]; size: number }
  const pts = props.points
  const threshold = props.size / 2 + tolerance
  const p = localPoint(record, point)
  if (pts.length === 2) {
    return Math.hypot(p.x - pts[0], p.y - pts[1]) <= threshold
  }
  for (let i = 0; i < pts.length - 2; i += 2) {
    const d = distToSegment(
      p,
      { x: pts[i], y: pts[i + 1] },
      { x: pts[i + 2], y: pts[i + 3] },
    )
    if (d <= threshold) return true
  }
  return false
}

function hitBox(record: SceneRecord, point: Point, tolerance: number, ellipse = false): boolean {
  const p = localPoint(record, point)
  const t = tolerance
  if (ellipse) {
    const rx = record.w / 2
    const ry = record.h / 2
    if (rx <= 0 || ry <= 0) return false
    const nx = (p.x - rx) / (rx + t)
    const ny = (p.y - ry) / (ry + t)
    return nx * nx + ny * ny <= 1
  }
  return p.x >= -t && p.y >= -t && p.x <= record.w + t && p.y <= record.h + t
}

function hitPolygon(record: SceneRecord, point: Point, tolerance: number): boolean {
  const p = localPoint(record, point)
  const w = record.w
  const h = record.h
  const polygon: Point[] =
    record.type === 'triangle'
      ? [
          { x: w / 2, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ]
      : [
          { x: w / 2, y: 0 },
          { x: w, y: h / 2 },
          { x: w / 2, y: h },
          { x: 0, y: h / 2 },
        ]
  if (pointInPolygon(p, polygon)) return true
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    if (distToSegment(p, a, b) <= tolerance) return true
  }
  return false
}

function hitLine(record: SceneRecord, point: Point, tolerance: number): boolean {
  const props = record.props as { n1x: number; n1y: number; n2x: number; n2y: number; size: number }
  const p = localPoint(record, point)
  const a = { x: props.n1x * record.w, y: props.n1y * record.h }
  const b = { x: props.n2x * record.w, y: props.n2y * record.h }
  return distToSegment(p, a, b) <= props.size / 2 + tolerance
}

/** 精确命中判定：不同记录类型采用不同策略 */
export function hitTestRecord(record: SceneRecord, point: Point, tolerance = 6): boolean {
  switch (record.type) {
    case 'ink':
      return hitInk(record, point, tolerance)
    case 'ellipse':
      return hitBox(record, point, tolerance, true)
    case 'triangle':
    case 'diamond':
      return hitPolygon(record, point, tolerance)
    case 'line':
    case 'arrow':
      return hitLine(record, point, tolerance)
    default:
      return hitBox(record, point, tolerance)
  }
}

/** 点到记录的距离（用于橡皮、最近点求解），返回 0 表示包含在内部 */
export function distanceToRecord(record: SceneRecord, point: Point): number {
  if (record.type === 'ink') {
    const props = record.props as { points: number[] }
    const pts = props.points
    const p = localPoint(record, point)
    let min = Infinity
    for (let i = 0; i < pts.length - 2; i += 2) {
      min = Math.min(min, distToSegment(p, { x: pts[i], y: pts[i + 1] }, { x: pts[i + 2], y: pts[i + 3] }))
    }
    return min
  }
  const p = localPoint(record, point)
  const dx = Math.max(0 - p.x, 0, p.x - record.w)
  const dy = Math.max(0 - p.y, 0, p.y - record.h)
  return Math.hypot(dx, dy)
}

export function isInkStroke(record: SceneRecord): boolean {
  return record.type === 'ink'
}
