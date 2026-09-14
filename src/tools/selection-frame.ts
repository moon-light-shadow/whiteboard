import { recordCenter, rotatePoint } from '../kernel/geometry'
import type { Camera } from '../kernel/camera'
import type { Point, SceneRecord } from '../kernel/types'
import { pixelToWorld, drawHandle, drawCircleHandle } from '../kernel/renderer/draw-common'

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

export interface SelectionFrame {
  center: Point
  rotation: number
  w: number
  h: number
}

const HANDLE_OFFSET_PX = 30
const HANDLE_SIZE_PX = 9
const HANDLE_HIT_PX = 11

/** 单个对象使用其自身旋转框；多选使用轴对齐外框 */
export function computeSelectionFrame(records: SceneRecord[]): SelectionFrame | null {
  if (records.length === 0) return null
  if (records.length === 1) {
    const record = records[0]
    return { center: recordCenter(record), rotation: record.rotation, w: record.w, h: record.h }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const record of records) {
    const c = recordCenter(record)
    const cos = Math.cos(record.rotation)
    const sin = Math.sin(record.rotation)
    const hw = record.w / 2
    const hh = record.h / 2
    for (const corner of [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ]) {
      const x = c.x + corner.x * cos - corner.y * sin
      const y = c.y + corner.x * sin + corner.y * cos
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    rotation: 0,
    w: maxX - minX,
    h: maxY - minY,
  }
}

/** 手柄在帧局部坐标中的位置（相对帧中心） */
export function handleLocalPoint(frame: SelectionFrame, id: HandleId, camera: Camera): Point {
  const hw = frame.w / 2
  const hh = frame.h / 2
  const offset = pixelToWorld(HANDLE_OFFSET_PX, camera)
  switch (id) {
    case 'nw':
      return { x: -hw, y: -hh }
    case 'n':
      return { x: 0, y: -hh }
    case 'ne':
      return { x: hw, y: -hh }
    case 'e':
      return { x: hw, y: 0 }
    case 'se':
      return { x: hw, y: hh }
    case 's':
      return { x: 0, y: hh }
    case 'sw':
      return { x: -hw, y: hh }
    case 'w':
      return { x: -hw, y: 0 }
    default:
      return { x: 0, y: -hh - offset }
  }
}

export function handleWorldPoint(frame: SelectionFrame, id: HandleId, camera: Camera): Point {
  const local = handleLocalPoint(frame, id, camera)
  return rotatePoint({ x: frame.center.x + local.x, y: frame.center.y + local.y }, frame.center, frame.rotation)
}

/** 世界坐标 -> 帧局部坐标（相对帧中心、去旋转） */
export function toFrameLocal(frame: SelectionFrame, point: Point): Point {
  const unrotated = rotatePoint(point, frame.center, -frame.rotation)
  return { x: unrotated.x - frame.center.x, y: unrotated.y - frame.center.y }
}

export function hitHandle(frame: SelectionFrame, world: Point, camera: Camera): HandleId | null {
  const tolerance = pixelToWorld(HANDLE_HIT_PX, camera)
  const ids: HandleId[] = ['rotate', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w']
  for (const id of ids) {
    const point = handleWorldPoint(frame, id, camera)
    if (Math.hypot(point.x - world.x, point.y - world.y) <= tolerance) return id
  }
  return null
}

const SCALE_HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** 缩放的锚点（相对帧中心的局部坐标） */
export function anchorForHandle(frame: SelectionFrame, id: HandleId): Point {
  switch (id) {
    case 'nw':
      return { x: frame.w / 2, y: frame.h / 2 }
    case 'n':
      return { x: 0, y: frame.h / 2 }
    case 'ne':
      return { x: -frame.w / 2, y: frame.h / 2 }
    case 'e':
      return { x: -frame.w / 2, y: 0 }
    case 'se':
      return { x: -frame.w / 2, y: -frame.h / 2 }
    case 's':
      return { x: 0, y: -frame.h / 2 }
    case 'sw':
      return { x: frame.w / 2, y: -frame.h / 2 }
    default:
      return { x: frame.w / 2, y: 0 }
  }
}

export function handleScalesAxis(id: HandleId): { x: boolean; y: boolean } {
  switch (id) {
    case 'n':
    case 's':
      return { x: false, y: true }
    case 'e':
    case 'w':
      return { x: true, y: false }
    default:
      return { x: true, y: true }
  }
}

export function cursorForHandle(id: HandleId): string {
  switch (id) {
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'nw':
    case 'se':
      return 'nwse-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    default:
      return 'grab'
  }
}

/** 绘制选区框与手柄（世界坐标，尺寸为固定屏幕像素） */
export function drawSelectionFrame(
  ctx: CanvasRenderingContext2D,
  frame: SelectionFrame,
  camera: Camera,
  options: { color: string; fill: string; activeHandle?: HandleId | null; showHandles: boolean },
): void {
  const corners = ['nw', 'ne', 'se', 'sw'].map((id) => handleWorldPoint(frame, id as HandleId, camera))
  ctx.save()
  ctx.strokeStyle = options.color
  ctx.lineWidth = pixelToWorld(1.5, camera)
  ctx.setLineDash([pixelToWorld(5, camera), pixelToWorld(4, camera)])
  ctx.beginPath()
  ctx.moveTo(corners[0].x, corners[0].y)
  for (let i = 1; i < corners.length; i += 1) ctx.lineTo(corners[i].x, corners[i].y)
  ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])
  if (!options.showHandles) {
    ctx.restore()
    return
  }
  if (frame.rotation !== 0 || true) {
    const top = handleWorldPoint(frame, 'n', camera)
    const rotate = handleWorldPoint(frame, 'rotate', camera)
    ctx.strokeStyle = options.color
    ctx.beginPath()
    ctx.moveTo(top.x, top.y)
    ctx.lineTo(rotate.x, rotate.y)
    ctx.stroke()
    drawCircleHandle(ctx, rotate, HANDLE_SIZE_PX + 1, camera, { fill: '#ffffff', stroke: options.color })
  }
  for (const id of SCALE_HANDLES) {
    const point = handleWorldPoint(frame, id, camera)
    const active = options.activeHandle === id
    drawHandle(ctx, point, HANDLE_SIZE_PX, camera, {
      fill: active ? options.color : '#ffffff',
      stroke: options.color,
    })
  }
  ctx.restore()
}
