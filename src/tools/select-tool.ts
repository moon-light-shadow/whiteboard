import { rectFromPoints } from '../kernel/geometry'
import { beginTransform, recordsBounds, rotateSession, scaleSession, translateSession, type TransformSession } from '../kernel/transform'
import type { Camera } from '../kernel/camera'
import type { Point, Rect, SceneRecord } from '../kernel/types'
import {
  anchorForHandle,
  computeSelectionFrame,
  cursorForHandle,
  drawSelectionFrame,
  handleScalesAxis,
  hitHandle,
  toFrameLocal,
  type HandleId,
  type SelectionFrame,
} from './selection-frame'
import { computeSnap, type GuideLines } from './snapping'
import { drawGuideLine, pixelToWorld } from '../kernel/renderer/draw-common'
import type { PointerSample, Tool, ToolContext } from './tool'

type Mode = 'idle' | 'marquee' | 'move' | 'scale' | 'rotate'

const SNAP_TOLERANCE_PX = 6
const UNIFORM_SCALE_PX = 8

/** 选择工具：点选、框选、移动、缩放、旋转，含对齐参考线 */
export class SelectTool implements Tool {
  readonly id = 'select' as const
  readonly cursor = 'default'
  private mode: Mode = 'idle'
  private session: TransformSession | null = null
  private frame: SelectionFrame | null = null
  private startWorld: Point | null = null
  private startAngle = 0
  private marqueeStart: Point | null = null
  private marqueeCurrent: Point | null = null
  private activeHandle: HandleId | null = null
  private guides: GuideLines = { xs: [], ys: [] }
  private additive = false
  private hoverCursor: string | null = null

  onPointerDown(event: PointerSample, ctx: ToolContext): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const camera = ctx.getCamera()
    const selected = this.selectedRecords(ctx)
    const frame = computeSelectionFrame(selected)

    if (frame) {
      const handle = hitHandle(frame, event.world, camera)
      if (handle) {
        this.frame = frame
        this.session = beginTransform(selected, { center: frame.center, rotation: frame.rotation })
        this.activeHandle = handle
        this.startWorld = event.world
        this.startAngle = Math.atan2(event.world.y - frame.center.y, event.world.x - frame.center.x)
        this.mode = handle === 'rotate' ? 'rotate' : 'scale'
        ctx.requestOverlay()
        return
      }
    }

    const hit = ctx.hitTest(event.world, pixelToWorld(6, camera))
    if (hit) {
      if (event.shiftKey) {
        ctx.setSelection([hit.id], { additive: true })
      } else if (!ctx.getSelection().includes(hit.id)) {
        ctx.setSelection([hit.id])
      }
      const nextRecords = this.selectedRecords(ctx)
      const nextFrame = computeSelectionFrame(nextRecords)
      if (nextFrame) {
        this.frame = nextFrame
        this.session = beginTransform(nextRecords, { center: nextFrame.center, rotation: nextFrame.rotation })
        this.startWorld = event.world
        this.mode = 'move'
      }
      ctx.requestOverlay()
      return
    }

    if (!event.shiftKey) ctx.setSelection([])
    this.additive = event.shiftKey
    this.marqueeStart = event.world
    this.marqueeCurrent = event.world
    this.mode = 'marquee'
    ctx.requestOverlay()
  }

  onPointerMove(event: PointerSample, ctx: ToolContext): void {
    this.hoverCursor = null
    switch (this.mode) {
      case 'move':
        this.applyMove(event, ctx)
        break
      case 'scale':
        this.applyScale(event, ctx)
        break
      case 'rotate':
        this.applyRotate(event, ctx)
        break
      case 'marquee':
        this.marqueeCurrent = event.world
        ctx.requestOverlay()
        break
      default: {
        const selected = this.selectedRecords(ctx)
        const frame = computeSelectionFrame(selected)
        if (frame) {
          const handle = hitHandle(frame, event.world, ctx.getCamera())
          this.hoverCursor = handle ? cursorForHandle(handle) : null
        }
        break
      }
    }
  }

  onPointerUp(_event: PointerSample, ctx: ToolContext): void {
    if (this.mode === 'marquee' && this.marqueeStart && this.marqueeCurrent) {
      const rect = rectFromPoints(this.marqueeStart, this.marqueeCurrent)
      if (rect.w > 2 || rect.h > 2) {
        const found = ctx.scene.hitAll(rect, 'intersect')
        const ids = found.map((record) => record.id)
        ctx.setSelection(ids, { additive: this.additive })
      }
    }
    this.mode = 'idle'
    this.session = null
    this.startWorld = null
    this.activeHandle = null
    this.marqueeStart = null
    this.marqueeCurrent = null
    this.additive = false
    this.guides = { xs: [], ys: [] }
    ctx.requestOverlay()
  }

  onDoubleClick(event: PointerSample, ctx: ToolContext): void {
    const hit = ctx.hitTest(event.world, pixelToWorld(6, ctx.getCamera()))
    if (!hit) return
    if (hit.type === 'note' || hit.type === 'text') {
      ctx.setSelection([hit.id])
      ctx.startEditing(hit.id, { selectAll: false, caretToEnd: true })
    }
  }

  cursorFor(): string | null {
    return this.hoverCursor
  }

  deactivate(): void {
    this.mode = 'idle'
    this.session = null
    this.marqueeStart = null
    this.marqueeCurrent = null
    this.activeHandle = null
    this.guides = { xs: [], ys: [] }
  }

  drawDraft(ctx2d: CanvasRenderingContext2D, camera: Camera, ctx: ToolContext): void {
    const selectionColor = ctx.isDark() ? '#818cf8' : '#4f46e5'
    const guideColor = ctx.isDark() ? '#38bdf8' : '#0ea5e9'

    // 选中描边由引擎统一绘制（见 board-engine 的 overlayDrawer），这里只画交互过程中的临时图形
    if (this.mode === 'marquee' && this.marqueeStart && this.marqueeCurrent) {
      const rect = rectFromPoints(this.marqueeStart, this.marqueeCurrent)
      ctx2d.save()
      ctx2d.fillStyle = ctx.isDark() ? 'rgba(129,140,248,0.14)' : 'rgba(79,70,229,0.08)'
      ctx2d.strokeStyle = selectionColor
      ctx2d.lineWidth = pixelToWorld(1, camera)
      ctx2d.setLineDash([pixelToWorld(5, camera), pixelToWorld(4, camera)])
      ctx2d.fillRect(rect.x, rect.y, rect.w, rect.h)
      ctx2d.strokeRect(rect.x, rect.y, rect.w, rect.h)
      ctx2d.restore()
    } else if (this.frame && this.mode !== 'idle') {
      drawSelectionFrame(ctx2d, this.frame, camera, {
        color: selectionColor,
        fill: 'transparent',
        activeHandle: this.activeHandle,
        showHandles: false,
      })
    }

    for (const x of this.guides.xs) {
      drawGuideLine(ctx2d, x, camera.y, x, camera.y + 1e6, camera, guideColor)
    }
    for (const y of this.guides.ys) {
      drawGuideLine(ctx2d, camera.x, y, camera.x + 1e6, y, camera, guideColor)
    }
  }

  private selectedRecords(ctx: ToolContext): SceneRecord[] {
    const result: SceneRecord[] = []
    for (const id of ctx.getSelection()) {
      const record = ctx.scene.get(id)
      if (record) result.push(record)
    }
    return result
  }

  private applyMove(event: PointerSample, ctx: ToolContext): void {
    if (!this.session || !this.startWorld) return
    let dx = event.world.x - this.startWorld.x
    let dy = event.world.y - this.startWorld.y

    const movingBounds = recordsBounds(this.session.originals)
    if (movingBounds && !event.altKey) {
      const tolerance = pixelToWorld(SNAP_TOLERANCE_PX, ctx.getCamera())
      const probe: Rect = {
        x: movingBounds.x + dx - 320,
        y: movingBounds.y + dy - 320,
        w: movingBounds.w + 640,
        h: movingBounds.h + 640,
      }
      const sessionIds = new Set(this.session.originals.map((record) => record.id))
      const targets = ctx.scene
        .query(probe)
        .filter((record) => !sessionIds.has(record.id))
        .map((record) => ({ x: record.x, y: record.y, w: record.w, h: record.h }))
      const snap = computeSnap(
        { x: movingBounds.x + dx, y: movingBounds.y + dy, w: movingBounds.w, h: movingBounds.h },
        targets,
        tolerance,
      )
      dx += snap.dx
      dy += snap.dy
      this.guides = snap.guides
    } else {
      this.guides = { xs: [], ys: [] }
    }

    const patches = translateSession(this.session, dx, dy)
    ctx.commit(ctx.scene.update(patches, 'move'), { merge: true })
    ctx.requestOverlay()
  }

  private applyScale(event: PointerSample, ctx: ToolContext): void {
    if (!this.session || !this.frame || !this.startWorld || !this.activeHandle) return
    const frame = this.frame
    const anchor = anchorForHandle(frame, this.activeHandle)
    const axis = handleScalesAxis(this.activeHandle)
    const startLocal = toFrameLocal(frame, this.startWorld)
    const currentLocal = toFrameLocal(frame, event.world)

    const denominatorX = startLocal.x - anchor.x
    const denominatorY = startLocal.y - anchor.y
    let sx = axis.x && Math.abs(denominatorX) > 0.01 ? (currentLocal.x - anchor.x) / denominatorX : 1
    let sy = axis.y && Math.abs(denominatorY) > 0.01 ? (currentLocal.y - anchor.y) / denominatorY : 1

    const uniform = event.shiftKey || this.session.originals.length > 1
    if (uniform && axis.x && axis.y) {
      const magnitude = Math.max(Math.abs(sx), Math.abs(sy))
      sx = (sx < 0 ? -1 : 1) * magnitude
      sy = (sy < 0 ? -1 : 1) * magnitude
    } else if (uniform && axis.x) {
      sy = sx
    } else if (uniform && axis.y) {
      sx = sy
    }

    const patches = scaleSession(this.session, sx, sy, anchor)
    ctx.commit(ctx.scene.update(patches, 'transform'), { merge: true })
    ctx.requestOverlay()
  }

  private applyRotate(event: PointerSample, ctx: ToolContext): void {
    if (!this.session || !this.frame) return
    const frame = this.frame
    const angle = Math.atan2(event.world.y - frame.center.y, event.world.x - frame.center.x)
    let delta = angle - this.startAngle
    if (event.shiftKey) {
      const step = Math.PI / 12
      delta = Math.round(delta / step) * step
    }
    const patches = rotateSession(this.session, delta)
    ctx.commit(ctx.scene.update(patches, 'transform'), { merge: true })
    ctx.requestOverlay()
  }
}
