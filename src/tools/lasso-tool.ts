import { pointInPolygon, recordCenter, recordCorners } from '../kernel/geometry'
import { pixelToWorld } from '../kernel/renderer/draw-common'
import type { Camera } from '../kernel/camera'
import type { Point, SceneRecord } from '../kernel/types'
import type { PointerSample, Tool, ToolContext } from './tool'

/** 套索选择：自由勾勒后选中框内对象 */
export class LassoTool implements Tool {
  readonly id = 'lasso' as const
  readonly cursor = 'crosshair'
  private drawing = false
  private points: Point[] = []

  onPointerDown(event: PointerSample, ctx: ToolContext): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    this.drawing = true
    this.points = [event.world]
    ctx.requestOverlay()
  }

  onPointerMove(event: PointerSample, ctx: ToolContext): void {
    if (!this.drawing) return
    const minDistance = pixelToWorld(3, ctx.getCamera())
    for (const point of event.coalesced) {
      const last = this.points[this.points.length - 1]
      if (Math.hypot(point.x - last.x, point.y - last.y) >= minDistance) this.points.push(point)
    }
    ctx.requestOverlay()
  }

  onPointerUp(_event: PointerSample, ctx: ToolContext): void {
    if (!this.drawing) return
    this.drawing = false
    if (this.points.length >= 3) {
      const polygon = this.points
      const inside = ctx.scene.ordered().filter((record) => isInside(polygon, record))
      ctx.setSelection(inside.map((record) => record.id), { additive: false })
    }
    this.points = []
    ctx.requestOverlay()
  }

  deactivate(): void {
    this.drawing = false
    this.points = []
  }

  drawDraft(ctx2d: CanvasRenderingContext2D, camera: Camera, ctx: ToolContext): void {
    if (this.points.length < 2) return
    const color = ctx.isDark() ? '#818cf8' : '#4f46e5'
    ctx2d.save()
    ctx2d.beginPath()
    ctx2d.moveTo(this.points[0].x, this.points[0].y)
    for (let i = 1; i < this.points.length; i += 1) ctx2d.lineTo(this.points[i].x, this.points[i].y)
    ctx2d.closePath()
    ctx2d.fillStyle = ctx.isDark() ? 'rgba(129,140,248,0.14)' : 'rgba(79,70,229,0.08)'
    ctx2d.fill()
    ctx2d.strokeStyle = color
    ctx2d.lineWidth = pixelToWorld(1.5, camera)
    ctx2d.setLineDash([pixelToWorld(6, camera), pixelToWorld(4, camera)])
    ctx2d.stroke()
    ctx2d.restore()
  }
}

function isInside(polygon: Point[], record: SceneRecord): boolean {
  const center = recordCenter(record)
  if (pointInPolygon(center, polygon)) return true
  const corners = recordCorners(record)
  return corners.some((corner) => pointInPolygon(corner, polygon))
}
