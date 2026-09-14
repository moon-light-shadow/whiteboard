import { createNote } from '../kernel/factories'
import { rectFromPoints } from '../kernel/geometry'
import { drawNote } from '../kernel/renderer/draw-note'
import { useBoardStore } from '../store/board-store'
import type { Camera } from '../kernel/camera'
import type { Point, Rect } from '../kernel/types'
import type { PointerSample, Tool, ToolContext } from './tool'

const DEFAULT_SIZE = 220

/** 便签工具：单击创建默认便签，拖拽自定义尺寸，创建后立即进入编辑 */
export class NoteTool implements Tool {
  readonly id = 'note' as const
  readonly cursor = 'copy'
  private start: Point | null = null
  private current: Point | null = null

  onPointerDown(event: PointerSample, ctx: ToolContext): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    // 正在编辑时这一次点击用于结束上一次编辑（由输入框 blur 处理），不应再新建便签
    if (useBoardStore.getState().editing) return
    this.start = event.world
    this.current = event.world
    ctx.requestOverlay()
  }

  onPointerMove(event: PointerSample, ctx: ToolContext): void {
    if (!this.start) return
    this.current = event.world
    ctx.requestOverlay()
  }

  onPointerUp(event: PointerSample, ctx: ToolContext): void {
    if (!this.start) return
    const style = ctx.getStyle()
    const dragged = rectFromPoints(this.start, this.current ?? event.world)
    const rect: Rect =
      dragged.w > 60 && dragged.h > 60
        ? dragged
        : { x: this.start.x - DEFAULT_SIZE / 2, y: this.start.y - DEFAULT_SIZE / 2, w: DEFAULT_SIZE, h: DEFAULT_SIZE }
    const record = createNote(rect, {
      color: style.noteColor,
      textColor: style.noteTextColor,
      fontSize: style.noteFontSize,
    })
    ctx.commit(ctx.scene.add([record], 'add:note'))
    ctx.setSelection([record.id])
    // 编辑结束后由编辑层切回选择工具，编辑过程中保持便签工具激活
    ctx.startEditing(record.id, { selectAll: false, caretToEnd: false, isNew: true })
    this.start = null
    this.current = null
    ctx.requestOverlay()
  }

  deactivate(): void {
    this.start = null
    this.current = null
  }

  drawDraft(ctx2d: CanvasRenderingContext2D, _camera: Camera, ctx: ToolContext): void {
    if (!this.start || !this.current) return
    const rect = rectFromPoints(this.start, this.current)
    if (rect.w < 60 || rect.h < 60) return
    const style = ctx.getStyle()
    const preview = createNote(rect, {
      color: style.noteColor,
      textColor: style.noteTextColor,
      fontSize: style.noteFontSize,
    })
    drawNote(ctx2d, preview, ctx.isDark())
  }
}
