import {
  Eraser,
  Hand,
  Highlighter,
  Image as ImageIcon,
  Lasso,
  MousePointer2,
  MoveUpRight,
  Pen,
  Square,
  StickyNote,
  Type,
} from 'lucide-react'
import { cn } from '../primitives/cn'
import { Tooltip } from '../primitives/Tooltip'
import { useToolStore, type ToolId } from '../../store/tool-store'
import { useEngine } from '../canvas/engine-context'

interface ToolDef {
  id: ToolId
  icon: typeof Pen
  label: string
  shortcut: string
}

const TOOLS: ToolDef[] = [
  { id: 'select', icon: MousePointer2, label: '选择', shortcut: 'V' },
  { id: 'lasso', icon: Lasso, label: '套索', shortcut: 'L' },
  { id: 'pen', icon: Pen, label: '钢笔', shortcut: 'P' },
  { id: 'highlighter', icon: Highlighter, label: '荧光笔', shortcut: 'H' },
  { id: 'eraser', icon: Eraser, label: '橡皮', shortcut: 'E' },
  { id: 'note', icon: StickyNote, label: '便签', shortcut: 'N' },
  { id: 'text', icon: Type, label: '文字', shortcut: 'T' },
  { id: 'shape', icon: Square, label: '图形', shortcut: 'R' },
  { id: 'arrow', icon: MoveUpRight, label: '箭头', shortcut: 'A' },
  { id: 'hand', icon: Hand, label: '平移画布', shortcut: '空格' },
]

/** 左侧工具条：悬浮胶囊，选中态为品牌色实心块 */
export function LeftRail() {
  const engine = useEngine()
  const tool = useToolStore((state) => state.tool)
  const shapeKind = useToolStore((state) => state.shapeKind)

  const pickImage = () => {
    const world = engine.toWorld({ x: engine.viewport.w / 2, y: engine.viewport.h / 2 })
    void engine.importImageAt(world)
  }

  return (
    <div className="absolute left-4 top-1/2 z-30 -translate-y-1/2">
      <div className="wb-glass flex flex-col gap-1 rounded-[20px] p-1.5">
        {TOOLS.map((item) => {
          const Icon = item.icon
          const active = tool === item.id
          return (
            <Tooltip key={item.id} label={item.label} shortcut={item.shortcut} side="right">
              <button
                type="button"
                aria-label={item.label}
                onClick={() => engine.setTool(item.id)}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-[14px] transition-all duration-150 ease-swift',
                  active
                    ? 'scale-[1.04] bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,0.85)]'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content-primary',
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.3 : 2} />
              </button>
            </Tooltip>
          )
        })}
        <div className="mx-2 my-0.5 h-px bg-surface-border" />
        <Tooltip label="插入图片" shortcut="I" side="right">
          <button
            type="button"
            aria-label="插入图片"
            onClick={pickImage}
            className="flex h-10 w-10 items-center justify-center rounded-[14px] text-content-secondary transition-all duration-150 ease-swift hover:bg-surface-hover hover:text-content-primary"
          >
            <ImageIcon size={18} />
          </button>
        </Tooltip>
      </div>
      <p className="mt-2 w-14 text-center text-[10px] font-medium leading-tight text-content-muted">
        {tool === 'shape' ? `图形 · ${shapeKind === 'rect' ? '矩形' : shapeKind === 'ellipse' ? '椭圆' : shapeKind === 'roundedRect' ? '圆角' : shapeKind === 'triangle' ? '三角' : '菱形'}` : ''}
      </p>
    </div>
  )
}
