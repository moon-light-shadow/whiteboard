import type { PointerSample, Tool, ToolContext } from './tool'

/** 图片工具：点击画布选择本地图片插入 */
export class ImageTool implements Tool {
  readonly id = 'image' as const
  readonly cursor = 'copy'

  onPointerDown(event: PointerSample, ctx: ToolContext): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    void ctx.importImageAt(event.world)
    ctx.setTool('select')
  }
}
