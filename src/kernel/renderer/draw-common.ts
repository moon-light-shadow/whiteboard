import { recordCenter, recordCorners } from '../geometry'
import type { Camera } from '../camera'
import type { Point, SceneRecord } from '../types'

/** 建立世界坐标 -> 画布像素的变换（含 DPR 与相机） */
export function worldTransform(ctx: CanvasRenderingContext2D, camera: Camera, dpr: number): void {
  ctx.setTransform(dpr * camera.z, 0, 0, dpr * camera.z, -camera.x * camera.z * dpr, -camera.y * camera.z * dpr)
}

/** 屏幕像素长度换算为世界单位长度（让描边、手柄不随缩放变化） */
export function pixelToWorld(pixels: number, camera: Camera): number {
  return pixels / camera.z
}

/** 在「世界坐标系」中围绕记录中心旋转（用于直接以世界坐标绘制的图形） */
export function rotateAboutRecordCenter(ctx: CanvasRenderingContext2D, record: SceneRecord): void {
  if (!record.rotation) return
  const c = recordCenter(record)
  ctx.translate(c.x, c.y)
  ctx.rotate(record.rotation)
  ctx.translate(-c.x, -c.y)
}

/**
 * 应用「记录局部坐标 -> 世界坐标」的完整变换（含旋转）。
 * 回调内可直接按 (0,0)-(w,h) 的局部坐标绘制。
 */
export function withRecordTransform(
  ctx: CanvasRenderingContext2D,
  record: SceneRecord,
  draw: () => void,
): void {
  const mx = record.w / 2
  const my = record.h / 2
  ctx.save()
  ctx.translate(record.x + mx, record.y + my)
  if (record.rotation) ctx.rotate(record.rotation)
  ctx.translate(-mx, -my)
  draw()
  ctx.restore()
}

export function applyDash(ctx: CanvasRenderingContext2D, dash: number[] | null | undefined, scale: number): void {
  if (dash && dash.length > 0) {
    ctx.setLineDash(dash.map((value) => value * scale))
  } else {
    ctx.setLineDash([])
  }
}

export type PathLike = Path2D | CanvasRenderingContext2D

export function roundRectPath(path: PathLike, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  if (typeof path.roundRect === 'function') {
    path.roundRect(x, y, Math.max(w, 0.01), Math.max(h, 0.01), radius)
    return
  }
  path.moveTo(x + radius, y)
  path.lineTo(x + w - radius, y)
  path.quadraticCurveTo(x + w, y, x + w, y + radius)
  path.lineTo(x + w, y + h - radius)
  path.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  path.lineTo(x + radius, y + h)
  path.quadraticCurveTo(x, y + h, x, y + h - radius)
  path.lineTo(x, y + radius)
  path.quadraticCurveTo(x, y, x + radius, y)
  path.closePath()
}

/** 记录在世界坐标下的外轮廓折线（已含旋转） */
export function recordOutlinePoints(record: SceneRecord): Point[] {
  if (record.type === 'ink') {
    const props = record.props as { points: number[] }
    const center = recordCenter(record)
    const cos = Math.cos(record.rotation)
    const sin = Math.sin(record.rotation)
    const pts: Point[] = []
    for (let i = 0; i < props.points.length; i += 2) {
      const lx = props.points[i] + record.x - center.x
      const ly = props.points[i + 1] + record.y - center.y
      pts.push({ x: center.x + lx * cos - ly * sin, y: center.y + lx * sin + ly * cos })
    }
    return pts
  }
  return recordCorners(record)
}

/** 选区描边：世界坐标绘制，线宽固定为屏幕像素 */
export function strokeRecordOutline(
  ctx: CanvasRenderingContext2D,
  record: SceneRecord,
  camera: Camera,
  options: { color: string; width: number; dash?: number[] },
): void {
  const points = recordOutlinePoints(record)
  if (points.length === 0) return
  ctx.save()
  ctx.strokeStyle = options.color
  ctx.lineWidth = pixelToWorld(options.width, camera)
  ctx.setLineDash((options.dash ?? []).map((value) => pixelToWorld(value, camera)))
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (points.length === 1) {
    ctx.arc(points[0].x, points[0].y, pixelToWorld(2, camera), 0, Math.PI * 2)
    ctx.fillStyle = options.color
    ctx.fill()
  } else {
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
    if (record.type !== 'ink') ctx.closePath()
    ctx.stroke()
  }
  ctx.restore()
}

/** 屏幕像素单位的方形手柄 */
export function drawHandle(
  ctx: CanvasRenderingContext2D,
  point: Point,
  sizePx: number,
  camera: Camera,
  options: { fill: string; stroke: string; radius?: number },
): void {
  const size = pixelToWorld(sizePx, camera)
  const half = size / 2
  const radius = pixelToWorld(options.radius ?? 3, camera)
  ctx.beginPath()
  ctx.fillStyle = options.fill
  ctx.strokeStyle = options.stroke
  ctx.lineWidth = pixelToWorld(1.5, camera)
  roundRectPath(ctx, point.x - half, point.y - half, size, size, radius)
  ctx.fill()
  ctx.stroke()
}

export function drawCircleHandle(
  ctx: CanvasRenderingContext2D,
  point: Point,
  sizePx: number,
  camera: Camera,
  options: { fill: string; stroke: string },
): void {
  ctx.beginPath()
  ctx.fillStyle = options.fill
  ctx.strokeStyle = options.stroke
  ctx.lineWidth = pixelToWorld(1.5, camera)
  ctx.arc(point.x, point.y, pixelToWorld(sizePx / 2, camera), 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

/** 吸附参考线（世界坐标的一条直线） */
export function drawGuideLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  camera: Camera,
  color: string,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = pixelToWorld(1, camera)
  ctx.setLineDash([pixelToWorld(6, camera), pixelToWorld(4, camera)])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}
