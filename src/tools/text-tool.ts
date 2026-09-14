import { createText } from '../kernel/factories'
import { useBoardStore } from '../store/board-store'
import type { PointerSample, Tool, ToolContext } from './tool'

const DEFAULT_WIDTH = 280

/** 文字工具：点击创建文本并进入编辑 */
export class TextTool implements Tool {
  readonly id = 'text' as const
  readonly cursor = 'text'

  onPointerDown(event: PointerSample, ctx: ToolContext): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    // 正在编辑时这一次点击用于结束上一次编辑（由输入框 blur 处理），不应再新建文本
    if (useBoardStore.getState().editing) return
    const style = ctx.getStyle()
    const lineHeight = Math.round(style.textFontSize * 1.35)
    const record = createText(
      { x: event.world.x, y: event.world.y - lineHeight / 2, w: DEFAULT_WIDTH, h: lineHeight },
      {
        text: '',
        color: style.textColor,
        fontSize: style.textFontSize,
        bold: style.textBold,
      },
    )
    ctx.commit(ctx.scene.add([record], 'add:text'))
    ctx.setSelection([record.id])
    // 编辑结束后由编辑层切回选择工具，编辑过程中保持文字工具激活
    ctx.startEditing(record.id, { selectAll: false, caretToEnd: false, isNew: true })
    ctx.requestOverlay()
  }
}
