import { create } from 'zustand'
import type { InkStyle, LineKind, ShapeKind } from '../kernel/types'

export type ToolId =
  | 'select'
  | 'lasso'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'note'
  | 'text'
  | 'shape'
  | 'arrow'
  | 'image'
  | 'hand'

export interface ToolStyle {
  penColor: string
  penSize: number
  highlighterColor: string
  highlighterSize: number
  eraserSize: number
  shapeKind: ShapeKind
  shapeStroke: string
  shapeFill: string
  shapeSize: number
  shapeDashed: boolean
  lineKind: LineKind
  arrowDouble: boolean
  lineSize: number
  lineDashed: boolean
  noteColor: string
  noteTextColor: string
  noteFontSize: number
  textColor: string
  textFontSize: number
  textBold: boolean
}

export interface ToolState extends ToolStyle {
  tool: ToolId
  previousTool: ToolId
  /** 最近一次使用的绘图工具，Esc 后回到它 */
  lastDrawingTool: ToolId
  setTool: (tool: ToolId) => void
  setStyle: (patch: Partial<ToolStyle>) => void
}

/** 与样式栏的粗细档位保持一致，供 [ ] 快捷键逐档切换 */
export const INK_SIZE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 24] as const
export const HIGHLIGHTER_SIZE_STEPS = [8, 12, 16, 24, 32, 40, 48, 64] as const

export const DEFAULT_STYLE: ToolStyle = {
  penColor: '#111827',
  penSize: 3,
  highlighterColor: '#F59E0B',
  // 取值落在 HIGHLIGHTER_SIZE_STEPS 内，样式栏才有对应档位被选中
  highlighterSize: 16,
  eraserSize: 18,
  shapeKind: 'rect',
  shapeStroke: '#1f2937',
  shapeFill: 'transparent',
  shapeSize: 2,
  shapeDashed: false,
  lineKind: 'arrow',
  arrowDouble: false,
  lineSize: 2,
  lineDashed: false,
  noteColor: '#FFE7A0',
  noteTextColor: '#3f2d0b',
  noteFontSize: 16,
  textColor: '#111827',
  textFontSize: 20,
  textBold: false,
}

export const useToolStore = create<ToolState>((set, get) => ({
  ...DEFAULT_STYLE,
  tool: 'select',
  previousTool: 'select',
  lastDrawingTool: 'pen',
  setTool: (tool) => {
    const current = get().tool
    if (current === tool) return
    set({
      tool,
      previousTool: current,
      lastDrawingTool: tool === 'pen' || tool === 'highlighter' ? tool : get().lastDrawingTool,
    })
  },
  setStyle: (patch) => set(patch as Partial<ToolState>),
}))

export function inkSizeFor(style: Pick<ToolStyle, 'penSize' | 'highlighterSize'>, ink: InkStyle): number {
  return ink === 'highlighter' ? style.highlighterSize : style.penSize
}
