import { createShape } from '../kernel/factories'
import { rectFromPoints } from '../kernel/geometry'
import { drawShape } from '../kernel/renderer/draw-shapes'
import type { Camera } from '../kernel/camera'
import type { Point, ShapeRecord } from '../kernel/types'
import type { PointerSample, Tool, ToolContext } from './tool'

const DEFAULT_W = 180
const DEFAULT_H = 130

/** 图形工具：拖拽建形，单击创建默认尺寸 */
export class ShapeTool implements Tool {
  readonly id = 'shape' as const
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
    this.current = event.world
    ctx.requestOverlay()
  }

  onPointerUp(event: PointerSample, ctx: ToolContext): void {
    if (!this.dragging || !this.start) return
    this.dragging = false
    const style = ctx.getStyle()
    let rect = rectFromPoints(this.start, this.current ?? event.world)
    if (event.shiftKey) {
      const size = Math.max(rect.w, rect.h)
      rect = {
        x: event.world.x >= this.start.x ? rect.x : rect.x + rect.w - size,
        y: event.world.y >= this.start.y ? rect.y : rect.y + rect.h - size,
        w: size,
        h: size,
      }
    }
    if (rect.w < 6 && rect.h < 6) {
      rect = { x: this.start.x - DEFAULT_W / 2, y: this.start.y - DEFAULT_H / 2, w: DEFAULT_W, h: DEFAULT_H }
    } else if (rect.w < 6) {
      rect = { x: this.start.x - DEFAULT_W / 2, y: rect.y, w: DEFAULT_W, h: rect.h }
    } else if (rect.h < 6) {
      rect = { x: rect.x, y: this.start.y - DEFAULT_H / 2, w: rect.w, h: DEFAULT_H }
    }

    const record = createShape(style.shapeKind, rect, {
      stroke: style.shapeStroke,
      fill: style.shapeFill,
      size: style.shapeSize,
      dash: style.shapeDashed ? [10, 8] : null,
    })
    ctx.commit(ctx.scene.add([record], 'add:shape'))
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
    const rect = rectFromPoints(this.start, this.current)
    if (rect.w < 2 && rect.h < 2) return
    const preview = createShape(style.shapeKind, rect, {
      stroke: style.shapeStroke,
      fill: style.shapeFill,
      size: style.shapeSize,
      dash: style.shapeDashed ? [10, 8] : null,
    }) as ShapeRecord
    drawShape(ctx2d, preview)
  }
}
