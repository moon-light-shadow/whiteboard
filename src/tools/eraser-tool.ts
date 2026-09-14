import { createInk } from '../kernel/factories'
import { recordCenter, rotatePoint, toWorldPoint } from '../kernel/geometry'
import type { Camera } from '../kernel/camera'
import type { ChangeSet, InkRecord, Point, RecordId, SceneRecord } from '../kernel/types'
import type { PointerSample, Tool, ToolContext } from './tool'

interface StrokePiece {
  points: number[]
  pressures: number[]
}

/**
 * 橡皮：笔迹按折线分割擦除，其它对象整块删除。
 * 橡皮轨迹上的连续操作通过历史合并（merge）收敛为一条撤销记录。
 */
export class EraserTool implements Tool {
  readonly id = 'eraser' as const
  readonly cursor = 'none'
  private erasing = false
  private cursorWorld: Point | null = null
  private touched = new Set<RecordId>()

  onPointerDown(event: PointerSample, ctx: ToolContext): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    this.erasing = true
    this.touched.clear()
    this.cursorWorld = event.world
    this.eraseAt(event.world, ctx)
    ctx.requestOverlay()
  }

  onPointerMove(event: PointerSample, ctx: ToolContext): void {
    this.cursorWorld = event.world
    if (!this.erasing) {
      ctx.requestOverlay()
      return
    }
    for (let i = 0; i < event.coalesced.length; i += 1) {
      this.eraseAt(event.coalesced[i], ctx)
    }
    ctx.requestOverlay()
  }

  onPointerUp(event: PointerSample, ctx: ToolContext): void {
    if (!this.erasing) return
    this.eraseAt(event.world, ctx)
    this.erasing = false
    this.touched.clear()
    ctx.requestOverlay()
  }

  deactivate(): void {
    this.erasing = false
    this.cursorWorld = null
    this.touched.clear()
  }

  drawDraft(ctx2d: CanvasRenderingContext2D, camera: Camera, ctx: ToolContext): void {
    if (!this.cursorWorld) return
    const radius = ctx.getStyle().eraserSize / 2
    ctx2d.save()
    ctx2d.beginPath()
    ctx2d.arc(this.cursorWorld.x, this.cursorWorld.y, radius, 0, Math.PI * 2)
    ctx2d.fillStyle = ctx.isDark() ? 'rgba(226,232,240,0.16)' : 'rgba(15,23,42,0.08)'
    ctx2d.fill()
    ctx2d.strokeStyle = ctx.isDark() ? 'rgba(226,232,240,0.5)' : 'rgba(15,23,42,0.35)'
    ctx2d.lineWidth = 1 / camera.z
    ctx2d.stroke()
    ctx2d.restore()
  }

  private eraseAt(point: Point, ctx: ToolContext): void {
    const radius = ctx.getStyle().eraserSize / 2
    const probe = { x: point.x - radius, y: point.y - radius, w: radius * 2, h: radius * 2 }
    const candidates = ctx.scene.query(probe)
    if (candidates.length === 0) return
    const added: SceneRecord[] = []
    const removed: SceneRecord[] = []
    for (const record of candidates) {
      if (this.touched.has(record.id)) continue
      if (record.type === 'ink') {
        const result = splitStroke(record, point, radius)
        if (!result.touched) continue
        this.touched.add(record.id)
        removed.push(record)
        for (const piece of result.pieces) {
          added.push(
            createInk(piece.points, piece.pressures, {
              color: record.props.color,
              size: record.props.size,
              style: record.props.style,
              opacity: record.props.opacity,
            }),
          )
        }
      } else if (isNear(record, point, radius)) {
        this.touched.add(record.id)
        removed.push(record)
      }
    }
    if (removed.length === 0 && added.length === 0) return
    const change: ChangeSet = { label: 'erase', added, updated: [], removed }
    ctx.applyBatch(change, { merge: true })
  }
}

function isNear(record: SceneRecord, point: Point, radius: number): boolean {
  const center = recordCenter(record)
  const local = rotatePoint(point, center, -record.rotation)
  const dx = Math.max(record.x - local.x, 0, local.x - (record.x + record.w))
  const dy = Math.max(record.y - local.y, 0, local.y - (record.y + record.h))
  return Math.hypot(dx, dy) <= radius
}

/** 按橡皮圆切分笔迹：保留不被覆盖的连续片段 */
export function splitStroke(
  record: InkRecord,
  point: Point,
  radius: number,
): { touched: boolean; pieces: StrokePiece[] } {
  const local = record.props.points
  const pressures = record.props.pressures
  const radiusSq = radius * radius
  const pieces: StrokePiece[] = []
  let currentPoints: number[] = []
  let currentPressures: number[] = []
  let kept = 0

  for (let i = 0; i < local.length; i += 2) {
    const world = toWorldPoint(record, { x: local[i], y: local[i + 1] })
    const dx = world.x - point.x
    const dy = world.y - point.y
    const inside = dx * dx + dy * dy <= radiusSq
    if (inside) {
      if (currentPoints.length >= 4) {
        pieces.push({ points: currentPoints, pressures: currentPressures })
      }
      currentPoints = []
      currentPressures = []
    } else {
      kept += 1
      currentPoints.push(world.x, world.y)
      currentPressures.push(pressures[i / 2] ?? 0.5)
    }
  }
  if (currentPoints.length >= 4) pieces.push({ points: currentPoints, pressures: currentPressures })

  const touched = kept !== local.length / 2
  return { touched, pieces: touched ? pieces : [] }
}
