import { recordCenter, rotatePoint } from './geometry'
import type { Point, RecordId, RecordPatch, SceneRecord } from './types'

export interface TransformFrame {
  center: Point
  rotation: number
}

/** 变换会话：保存操作前的原始记录，避免连续变换累积误差 */
export interface TransformSession {
  originals: SceneRecord[]
  frame: TransformFrame
}

export interface PatchTarget {
  id: RecordId
  patch: RecordPatch
}

export function beginTransform(records: SceneRecord[], frame: TransformFrame): TransformSession {
  return { originals: records.map((record) => structuredCloneRecord(record)), frame }
}

function structuredCloneRecord(record: SceneRecord): SceneRecord {
  return { ...record, props: JSON.parse(JSON.stringify(record.props)) }
}

/** 帧局部坐标（相对帧中心、去除帧旋转） */
function toFrameLocal(session: TransformSession, point: Point): Point {
  const rotated = rotatePoint(point, session.frame.center, -session.frame.rotation)
  return { x: rotated.x - session.frame.center.x, y: rotated.y - session.frame.center.y }
}

function fromFrameLocal(session: TransformSession, local: Point): Point {
  const rotated = rotatePoint(
    { x: local.x + session.frame.center.x, y: local.y + session.frame.center.y },
    session.frame.center,
    session.frame.rotation,
  )
  return rotated
}

function patchFromCenter(record: SceneRecord, center: Point, w: number, h: number, extra?: Record<string, unknown>): RecordPatch {
  return {
    x: center.x - w / 2,
    y: center.y - h / 2,
    w,
    h,
    ...(extra ? { props: extra } : {}),
  }
}

export function translateSession(session: TransformSession, dx: number, dy: number): PatchTarget[] {
  return session.originals.map((record) => ({
    id: record.id,
    patch: { x: record.x + dx, y: record.y + dy },
  }))
}

export function scaleSession(
  session: TransformSession,
  sx: number,
  sy: number,
  anchor: Point = { x: 0, y: 0 },
): PatchTarget[] {
  const scaleX = Math.abs(sx) < 0.02 ? 0.02 : sx
  const scaleY = Math.abs(sy) < 0.02 ? 0.02 : sy
  return session.originals.map((record) => {
    const local = toFrameLocal(session, recordCenter(record))
    const scaled: Point = {
      x: anchor.x + (local.x - anchor.x) * scaleX,
      y: anchor.y + (local.y - anchor.y) * scaleY,
    }
    const center = fromFrameLocal(session, scaled)
    const w = Math.max(1, record.w * scaleX)
    const h = Math.max(1, record.h * scaleY)
    if (record.type === 'ink') {
      const props = record.props as { points: number[] }
      const points = props.points.map((value, index) => (index % 2 === 0 ? value * scaleX : value * scaleY))
      return { id: record.id, patch: patchFromCenter(record, center, w, h, { points }) }
    }
    return { id: record.id, patch: patchFromCenter(record, center, w, h) }
  })
}

export function rotateSession(session: TransformSession, delta: number): PatchTarget[] {
  return session.originals.map((record) => {
    const local = toFrameLocal(session, recordCenter(record))
    const orbited = rotatePoint({ x: local.x, y: local.y }, { x: 0, y: 0 }, delta)
    const center = fromFrameLocal(session, orbited)
    return {
      id: record.id,
      patch: {
        x: center.x - record.w / 2,
        y: center.y - record.h / 2,
        rotation: record.rotation + delta,
      },
    }
  })
}

/** 记录集合的包围盒（含旋转外框） */
export function recordsBounds(records: SceneRecord[]): { x: number; y: number; w: number; h: number } | null {
  if (records.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const record of records) {
    const hw = record.w / 2
    const hh = record.h / 2
    const c = recordCenter(record)
    const cos = Math.cos(record.rotation)
    const sin = Math.sin(record.rotation)
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
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
