import { getStroke } from 'perfect-freehand'
import { recordCenter } from '../geometry'
import type { Camera } from '../camera'
import type { InkRecord, InkStyle } from '../types'
import { PathCache } from './path-cache'

const pathCache = new PathCache()

export interface FreeformOptions {
  size: number
  style: InkStyle
}

function strokeConfig(options: FreeformOptions, hasPressure: boolean) {
  const highlighter = options.style === 'highlighter'
  return {
    size: options.size,
    thinning: highlighter ? 0 : 0.52,
    smoothing: highlighter ? 0.42 : 0.52,
    streamline: highlighter ? 0.35 : 0.5,
    easing: (t: number) => Math.sin((t * Math.PI) / 2),
    simulatePressure: !hasPressure,
    start: { taper: highlighter ? 0 : 4, cap: true },
    end: { taper: highlighter ? 0 : 4, cap: true },
    last: true,
  }
}

function toInput(points: number[], pressures: number[]): number[][] {
  const hasPressure = pressures.length * 2 === points.length && points.length > 0
  const input: number[][] = new Array(points.length / 2)
  for (let i = 0, j = 0; i < points.length; i += 2, j += 1) {
    const raw = hasPressure ? pressures[j] : 0.5
    input[j] = [points[i], points[i + 1], raw > 0 ? Math.min(1, Math.max(0.12, raw)) : 0.5]
  }
  if (input.length === 1) {
    input.push([input[0][0] + 0.4, input[0][1] + 0.4, input[0][2]])
  }
  return input
}

/** 由扁平点序列生成闭合轮廓（用于实时草稿绘制，零对象分配以外的开销） */
export function freeformOutline(points: number[], pressures: number[], options: FreeformOptions): number[][] {
  const hasPressure = pressures.length * 2 === points.length && pressures.some((p) => p > 0)
  const input = toInput(points, pressures)
  return getStroke(input, strokeConfig(options, hasPressure))
}

function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D()
  if (outline.length < 2) return path
  path.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i += 1) path.lineTo(outline[i][0], outline[i][1])
  path.closePath()
  return path
}

/** 实时草稿：直接以世界坐标绘制，供交互层使用 */
export function drawFreeform(
  ctx: CanvasRenderingContext2D,
  points: number[],
  pressures: number[],
  options: FreeformOptions & { color: string },
): void {
  if (points.length < 2) return
  const outline = freeformOutline(points, pressures, options)
  if (outline.length < 2) return
  ctx.save()
  if (options.style === 'highlighter') ctx.globalAlpha = 0.34
  ctx.fillStyle = options.color
  ctx.fill(outlineToPath(outline))
  ctx.restore()
}

/** 已提交笔迹：使用 Path2D 缓存，避免重复构建轮廓 */
export function drawInk(
  ctx: CanvasRenderingContext2D,
  record: InkRecord,
  _camera: Camera,
): void {
  const props = record.props
  if (props.points.length < 2) return
  const path = pathCache.get(record.id, record.version, () =>
    outlineToPath(
      freeformOutline(props.points, props.pressures, { size: props.size, style: props.style }),
    ),
  )
  const center = recordCenter(record)
  const mx = record.w / 2
  const my = record.h / 2
  ctx.save()
  ctx.translate(record.x + mx, record.y + my)
  if (record.rotation) ctx.rotate(record.rotation)
  ctx.translate(-mx, -my)
  if (props.style === 'highlighter') {
    ctx.globalAlpha = props.opacity ?? 0.34
  } else if (props.opacity !== undefined && props.opacity < 1) {
    ctx.globalAlpha = props.opacity
  }
  ctx.fillStyle = props.color
  ctx.fill(path)
  ctx.restore()
}

export function invalidateInkPath(id: string): void {
  pathCache.drop(id)
}

export function clearInkPathCache(): void {
  pathCache.clear()
}
