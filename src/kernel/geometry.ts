import type { Point, Rect, SceneRecord } from './types'

export const TAU = Math.PI * 2

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h }
}

/** 由任意两个角点构造规范化矩形（w/h 恒为正） */
export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

export function normalizeRect(r: Rect): Rect {
  return {
    x: r.w < 0 ? r.x + r.w : r.x,
    y: r.h < 0 ? r.y + r.h : r.y,
    w: Math.abs(r.w),
    h: Math.abs(r.h),
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)
}

export function rectContainsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  )
}

export function rectContainsPoint(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

export function rectExpand(r: Rect, amount: number): Rect {
  return { x: r.x - amount, y: r.y - amount, w: r.w + amount * 2, h: r.h + amount * 2 }
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    if (r.x < minX) minX = r.x
    if (r.y < minY) minY = r.y
    if (r.x + r.w > maxX) maxX = r.x + r.w
    if (r.y + r.h > maxY) maxY = r.y + r.h
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function recordRect(r: SceneRecord): Rect {
  return { x: r.x, y: r.y, w: r.w, h: r.h }
}

export function recordCenter(r: SceneRecord): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** 记录旋转后的四个角点（世界坐标，顺序：左上、右上、右下、左下） */
export function recordCorners(r: SceneRecord): Point[] {
  const c = recordCenter(r)
  const cos = Math.cos(r.rotation)
  const sin = Math.sin(r.rotation)
  const hw = r.w / 2
  const hh = r.h / 2
  const local: Point[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ]
  return local.map((p) => ({
    x: c.x + p.x * cos - p.y * sin,
    y: c.y + p.x * sin + p.y * cos,
  }))
}

export function rotatePoint(p: Point, center: Point, angle: number): Point {
  if (!angle) return { x: p.x, y: p.y }
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

/** 把世界坐标点转换到记录的局部坐标系（去掉旋转与平移） */
export function toLocalPoint(r: SceneRecord, p: Point): Point {
  const c = recordCenter(r)
  const rotated = rotatePoint(p, c, -r.rotation)
  return { x: rotated.x - r.x, y: rotated.y - r.y }
}

export function toWorldPoint(r: SceneRecord, local: Point): Point {
  const c = recordCenter(r)
  const translated = { x: local.x + r.x, y: local.y + r.y }
  return rotatePoint(translated, c, r.rotation)
}

/** 点到线段的最短距离 */
export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = clamp(t, 0, 1)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** 计算折线（扁平点数组）的包围盒 */
export function polylineBounds(points: number[], offsetX = 0, offsetY = 0): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] + offsetX
    const y = points[i + 1] + offsetY
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (!Number.isFinite(minX)) return { x: offsetX, y: offsetY, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** 射线法判断点是否在多边形内 */
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** 点到旋转矩形的距离（用于命中判定，返回 0 表示在内部） */
export function distanceToRecord(r: SceneRecord, p: Point): number {
  const local = toLocalPoint(r, p)
  const dx = Math.max(0 - local.x, 0, local.x - r.w)
  const dy = Math.max(0 - local.y, 0, local.y - r.h)
  return Math.hypot(dx, dy)
}

/** 记录旋转后的外包围盒 */
export function recordBounds(r: SceneRecord): Rect {
  if (!r.rotation || (r.rotation % TAU === 0)) return recordRect(r)
  return unionRects(recordCorners(r).map((p, i, arr) => rectFromPoints(p, arr[(i + 1) % arr.length]))) ?? recordRect(r)
}
