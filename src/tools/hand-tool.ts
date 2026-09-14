import { panCamera } from '../kernel/camera'
import type { Point } from '../kernel/types'
import type { PointerSample, Tool, ToolContext } from './tool'

const PAN_CURSORS = { idle: 'grab', active: 'grabbing' }

/** 手型工具：拖拽平移画布 */
export class HandTool implements Tool {
  readonly id = 'hand' as const
  readonly cursor = PAN_CURSORS.idle
  private panning = false
  private lastPoint: Point | null = null

  onPointerDown(event: PointerSample, _ctx: ToolContext): void {
    this.panning = true
    this.lastPoint = event.screen
  }

  onPointerMove(event: PointerSample, ctx: ToolContext): void {
    if (!this.panning || !this.lastPoint) return
    const dx = event.screen.x - this.lastPoint.x
    const dy = event.screen.y - this.lastPoint.y
    this.lastPoint = event.screen
    ctx.setCamera(panCamera(ctx.getCamera(), dx, dy))
  }

  onPointerUp(): void {
    this.panning = false
    this.lastPoint = null
  }

  deactivate(): void {
    this.panning = false
    this.lastPoint = null
  }

  get isPanning(): boolean {
    return this.panning
  }
}
