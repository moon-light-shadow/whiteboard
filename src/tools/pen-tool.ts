import { createInk } from '../kernel/factories'
import { drawFreeform } from '../kernel/renderer/draw-ink'
import type { Camera } from '../kernel/camera'
import type { InkStyle, Point } from '../kernel/types'
import type { ToolId } from '../store/tool-store'
import type { PointerSample, Tool, ToolContext } from './tool'

interface InkConfig {
  id: ToolId
  ink: InkStyle
  /** 颜色/粗细取自样式面板的哪一组 */
  source: InkStyle
  opacity: number
}

/** 压感笔迹工具（钢笔与荧光笔共用） */
export class InkTool implements Tool {
  readonly id: ToolId
  readonly cursor = 'crosshair'
  private config: InkConfig
  private drawing = false
  private points: number[] = []
  private pressures: number[] = []
  private color = '#111827'
  private size = 3
  private opacity = 1

  constructor(config: InkConfig) {
    this.config = config
    this.id = config.id
  }

  onPointerDown(event: PointerSample, ctx: ToolContext): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const style = ctx.getStyle()
    this.color = this.config.source === 'pen' ? style.penColor : style.highlighterColor
    this.size = this.config.source === 'pen' ? style.penSize : style.highlighterSize
    this.opacity = this.config.opacity
    this.points = [event.world.x, event.world.y]
    this.pressures = [event.pressure]
    this.drawing = true
    ctx.requestOverlay()
  }

  onPointerMove(event: PointerSample, ctx: ToolContext): void {
    if (!this.drawing) return
    const minDistance = 0.7 / ctx.getCamera().z
    for (let i = 0; i < event.coalesced.length; i += 1) {
      this.append(event.coalesced[i], event.coalescedPressure[i] ?? event.pressure, minDistance)
    }
    ctx.requestOverlay()
  }

  onPointerUp(event: PointerSample, ctx: ToolContext): void {
    if (!this.drawing) return
    this.append(event.world, event.pressure, 0.4 / ctx.getCamera().z)
    this.drawing = false
    if (this.points.length >= 4) {
      const record = createInk(this.points, this.pressures, {
        color: this.color,
        size: this.size,
        style: this.config.ink,
        opacity: this.opacity,
      })
      ctx.commit(ctx.scene.add([record], 'draw'))
    } else if (this.points.length === 2) {
      const record = createInk(
        [this.points[0], this.points[1], this.points[0] + 0.35, this.points[1] + 0.35],
        [this.pressures[0], this.pressures[0], this.pressures[0]],
        { color: this.color, size: this.size, style: this.config.ink, opacity: this.opacity },
      )
      ctx.commit(ctx.scene.add([record], 'draw'))
    }
    this.points = []
    this.pressures = []
    ctx.requestOverlay()
  }

  deactivate(): void {
    this.drawing = false
    this.points = []
    this.pressures = []
  }

  drawDraft(ctx2d: CanvasRenderingContext2D, _camera: Camera, _ctx: ToolContext): void {
    if (!this.drawing || this.points.length < 4) return
    drawFreeform(ctx2d, this.points, this.pressures, {
      size: this.size,
      style: this.config.ink,
      color: this.color,
    })
  }

  private append(point: Point, pressure: number, minDistance: number): void {
    const length = this.points.length
    if (length >= 2) {
      const dx = point.x - this.points[length - 2]
      const dy = point.y - this.points[length - 1]
      if (dx * dx + dy * dy < minDistance * minDistance) return
    }
    this.points.push(point.x, point.y)
    this.pressures.push(pressure > 0 ? pressure : 0.5)
    if (this.points.length > 8000) {
      this.points = this.points.slice(-4000)
      this.pressures = this.pressures.slice(-2000)
    }
  }
}

export function createPenTool(): InkTool {
  return new InkTool({ id: 'pen', ink: 'pen', source: 'pen', opacity: 1 })
}

export function createHighlighterTool(): InkTool {
  return new InkTool({ id: 'highlighter', ink: 'highlighter', source: 'highlighter', opacity: 0.34 })
}
