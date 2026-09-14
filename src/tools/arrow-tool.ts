import { createArrow } from '../kernel/factories'
import { drawArrow } from '../kernel/renderer/draw-shapes'
import type { Camera } from '../kernel/camera'
import type { Point } from '../kernel/types'
import type { PointerSample, Tool, ToolContext } from './tool'

const SNAP_STEP = Math.PI / 12

/** 直线 / 箭头工具，Shift 吸附 15° */
export class ArrowTool implements Tool {
  readonly id = 'arrow' as const
  readonly cursor = 'crosshair'
  private start: Point | null = null
  private current: Point | null = null
  private dragging = false

  onPointerDown(event: PointerSample, ctx: ToolContext): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    this.start = event.world
    this.current = event.world
    this.dragging = true
    ctx.requestOverlay()
  }

  onPointerMove(event: PointerSample, ctx: ToolContext): void {
    if (!this.dragging) return
    this.current = this.resolveEnd(event, ctx)
    ctx.requestOverlay()
  }

  onPointerUp(event: PointerSample, ctx: ToolContext): void {
    if (!this.dragging || !this.start) return
    this.dragging = false
    const style = ctx.getStyle()
    let end = this.resolveEnd(event, ctx)
    if (Math.hypot(end.x - this.start.x, end.y - this.start.y) < 6) {
      end = { x: this.start.x + 220, y: this.start.y }
    }
    const record = createArrow(style.lineKind, this.start, end, {
      stroke: style.shapeStroke,
      size: style.lineSize,
      double: style.arrowDouble,
      dash: style.lineDashed ? [10, 8] : null,
    })
    ctx.commit(ctx.scene.add([record], 'add:arrow'))
    ctx.setSelection([record.id])
    ctx.setTool('select')
    this.start = null
    this.current = null
    ctx.requestOverlay()
  }

  deactivate(): void {
    this.dragging = false
    this.start = null
    this.current = null
  }

  drawDraft(ctx2d: CanvasRenderingContext2D, _camera: Camera, ctx: ToolContext): void {
    if (!this.dragging || !this.start || !this.current) return
    const style = ctx.getStyle()
    const preview = createArrow(style.lineKind, this.start, this.current, {
      stroke: style.shapeStroke,
      size: style.lineSize,
      double: style.arrowDouble,
      dash: style.lineDashed ? [10, 8] : null,
    })
    drawArrow(ctx2d, preview, _camera)
  }

  private resolveEnd(event: PointerSample, ctx: ToolContext): Point {
    if (!event.shiftKey || !this.start) return event.world
    void ctx
    const dx = event.world.x - this.start.x
    const dy = event.world.y - this.start.y
    const angle = Math.atan2(dy, dx)
    const snapped = Math.round(angle / SNAP_STEP) * SNAP_STEP
    const length = Math.hypot(dx, dy)
    return { x: this.start.x + Math.cos(snapped) * length, y: this.start.y + Math.sin(snapped) * length }
  }
}
