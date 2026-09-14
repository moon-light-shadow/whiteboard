import type { ReactNode } from 'react'
import { ArrowDownToLine, ArrowUpToLine, Bold, BringToFront, Copy, Layers, SendToBack, Trash2 } from 'lucide-react'
import { INK_COLORS } from '../../kernel/factories'
import type { LineKind, ShapeKind } from '../../kernel/types'
import { useBoardStore } from '../../store/board-store'
import { useToolStore, type ToolStyle } from '../../store/tool-store'
import { cn } from '../primitives/cn'
import { Button, IconButton } from '../primitives/Button'
import { ColorGrid } from '../primitives/ColorSwatch'
import { Segmented } from '../primitives/Segmented'
import { Slider } from '../primitives/Slider'
import { Tooltip } from '../primitives/Tooltip'
import { useEngine } from '../canvas/engine-context'
import {
  applyStyleToSelection,
  copySelection,
  deleteSelection,
  duplicateSelection,
  reorderSelection,
} from '../canvas/engine-commands'

const HIGHLIGHT_COLORS = ['#FEF08A', '#FDBA74', '#FCA5A5', '#A7F3D0', '#BFDBFE', '#DDD6FE', '#F9A8D4', '#99F6E4']
const NOTE_PALETTE = ['#FFE7A0', '#B7E4C7', '#BFDBFE', '#FBCFE8', '#DDD6FE', '#FED7AA', '#E2E8F0', '#FCA5A5']
const PEN_SIZES = [1, 2, 3, 4, 6, 8, 12, 16, 24]
const HIGHLIGHT_SIZES = [8, 12, 16, 24, 32, 40, 48, 64]

const SHAPE_OPTIONS: Array<{ value: ShapeKind; label: string }> = [
  { value: 'rect', label: '矩形' },
  { value: 'roundedRect', label: '圆角' },
  { value: 'ellipse', label: '椭圆' },
  { value: 'triangle', label: '三角' },
  { value: 'diamond', label: '菱形' },
]

const LINE_OPTIONS: Array<{ value: LineKind; label: string }> = [
  { value: 'line', label: '直线' },
  { value: 'arrow', label: '箭头' },
]

function Divider() {
  return <div className="h-6 w-px bg-surface-border" />
}

function SizeDots({
  sizes,
  value,
  onPick,
  scale = 0.6,
}: {
  sizes: number[]
  value: number
  onPick: (size: number) => void
  /** 每个档位对应的圆点像素增量；高亮笔档位跨度大，需要更小的增量 */
  scale?: number
}) {
  return (
    <div className="flex items-center gap-1">
      {sizes.map((size) => {
        const dot = Math.min(19, 3 + size * scale)
        return (
          <button
            key={size}
            type="button"
            aria-label={`粗细 ${size}`}
            title={`粗细 ${size}`}
            onClick={() => onPick(size)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-[10px] transition-colors duration-150',
              size === value ? 'bg-brand-500/12 ring-1 ring-brand-500/40' : 'hover:bg-surface-hover',
            )}
          >
            <span className="rounded-full bg-content-primary" style={{ width: dot, height: dot }} />
          </button>
        )
      })}
    </div>
  )
}

function Toggle({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon?: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] font-medium transition-all duration-150 ease-swift',
        active ? 'bg-brand-500/14 text-brand-600 ring-1 ring-brand-500/35 dark:text-brand-300' : 'text-content-secondary hover:bg-surface-hover',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

/** 底部上下文样式栏：随工具切换内容，选中对象时同步修改对象样式 */
export function StyleBar() {
  const engine = useEngine()
  const tool = useToolStore((state) => state.tool)
  const style = useToolStore()
  const selection = useBoardStore((state) => state.selection)
  const hasSelection = selection.length > 0

  const patch = (next: Partial<ToolStyle>) => {
    useToolStore.getState().setStyle(next)
    if (hasSelection && (tool === 'select' || tool === 'lasso')) {
      applyStyleToSelection(engine, { ...useToolStore.getState(), ...next })
    }
  }

  const body = () => {
    switch (tool) {
      case 'pen':
        return (
          <>
            <ColorGrid
              colors={INK_COLORS}
              value={style.penColor}
              onChange={(color) => patch({ penColor: color })}
              columns={9}
              allowCustom
            />
            <Divider />
            <SizeDots sizes={PEN_SIZES} value={style.penSize} onPick={(size) => patch({ penSize: size })} />
          </>
        )
      case 'highlighter':
        return (
          <>
            <ColorGrid
              colors={HIGHLIGHT_COLORS}
              value={style.highlighterColor}
              onChange={(color) => patch({ highlighterColor: color })}
              columns={9}
              allowCustom
            />
            <Divider />
            <SizeDots
              sizes={HIGHLIGHT_SIZES}
              value={style.highlighterSize}
              onPick={(size) => patch({ highlighterSize: size })}
              scale={0.26}
            />
          </>
        )
      case 'eraser':
        return (
          <div className="flex w-64 items-center gap-3">
            <span className="text-[11.5px] font-medium text-content-secondary">橡皮大小</span>
            <Slider
              ariaLabel="橡皮大小"
              min={6}
              max={64}
              value={style.eraserSize}
              onChange={(value) => patch({ eraserSize: value })}
              format={(value) => `${value}`}
            />
          </div>
        )
      case 'note':
        return (
          <>
            <ColorGrid
              colors={NOTE_PALETTE}
              value={style.noteColor}
              onChange={(color) => patch({ noteColor: color })}
              columns={9}
              allowCustom
            />
            <Divider />
            <div className="flex w-44 items-center gap-3">
              <span className="text-[11.5px] font-medium text-content-secondary">字号</span>
              <Slider
                ariaLabel="便签字号"
                min={12}
                max={36}
                value={style.noteFontSize}
                onChange={(value) => patch({ noteFontSize: value })}
                format={(value) => `${value}`}
              />
            </div>
          </>
        )
      case 'text':
        return (
          <>
            <ColorGrid
              colors={INK_COLORS}
              value={style.textColor}
              onChange={(color) => patch({ textColor: color })}
              columns={9}
              allowCustom
            />
            <Divider />
            <div className="flex w-44 items-center gap-3">
              <span className="text-[11.5px] font-medium text-content-secondary">字号</span>
              <Slider
                ariaLabel="文字字号"
                min={12}
                max={72}
                value={style.textFontSize}
                onChange={(value) => patch({ textFontSize: value })}
                format={(value) => `${value}`}
              />
            </div>
            <Toggle
              active={style.textBold}
              label="加粗"
              icon={<Bold size={13} />}
              onClick={() => patch({ textBold: !style.textBold })}
            />
          </>
        )
      case 'shape':
        return (
          <>
            <Segmented value={style.shapeKind} options={SHAPE_OPTIONS} onChange={(value) => patch({ shapeKind: value })} size="sm" />
            <Divider />
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] font-medium text-content-secondary">描边</span>
              <ColorGrid
                colors={INK_COLORS}
                value={style.shapeStroke}
                onChange={(color) => patch({ shapeStroke: color })}
                columns={9}
                size="sm"
                allowCustom
              />
            </div>
            <Divider />
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] font-medium text-content-secondary">填充</span>
              <ColorGrid
                colors={NOTE_PALETTE}
                value={style.shapeFill}
                onChange={(color) => patch({ shapeFill: color })}
                columns={10}
                size="sm"
                allowTransparent
                allowCustom
              />
            </div>
            <Divider />
            <div className="flex w-36 items-center gap-2">
              <span className="text-[11.5px] font-medium text-content-secondary">线宽</span>
              <Slider
                ariaLabel="线宽"
                min={1}
                max={16}
                value={style.shapeSize}
                onChange={(value) => patch({ shapeSize: value })}
                format={(value) => `${value}`}
              />
            </div>
            <Toggle active={style.shapeDashed} label="虚线" onClick={() => patch({ shapeDashed: !style.shapeDashed })} />
          </>
        )
      case 'arrow':
        return (
          <>
            <Segmented value={style.lineKind} options={LINE_OPTIONS} onChange={(value) => patch({ lineKind: value })} size="sm" />
            <Toggle active={style.arrowDouble} label="双向箭头" onClick={() => patch({ arrowDouble: !style.arrowDouble })} />
            <Divider />
            <ColorGrid
              colors={INK_COLORS}
              value={style.shapeStroke}
              onChange={(color) => patch({ shapeStroke: color })}
              columns={9}
              allowCustom
            />
            <Divider />
            <div className="flex w-36 items-center gap-2">
              <span className="text-[11.5px] font-medium text-content-secondary">线宽</span>
              <Slider
                ariaLabel="线宽"
                min={1}
                max={16}
                value={style.lineSize}
                onChange={(value) => patch({ lineSize: value })}
                format={(value) => `${value}`}
              />
            </div>
            <Toggle active={style.lineDashed} label="虚线" onClick={() => patch({ lineDashed: !style.lineDashed })} />
          </>
        )
      case 'hand':
        return <span className="px-2 text-[12px] text-content-secondary">按住并拖动可平移画布，滚轮缩放，空格键临时切换</span>
      case 'lasso':
        return <span className="px-2 text-[12px] text-content-secondary">按住拖动圈选对象，Shift 可叠加选择</span>
      default:
        return (
          <>
            <div className="flex items-center gap-0.5">
              <Tooltip label="置于顶层" shortcut="Ctrl+]">
                <IconButton size="icon-sm" label="置于顶层" disabled={!hasSelection} onClick={() => reorderSelection(engine, 'front')}>
                  <BringToFront size={15} />
                </IconButton>
              </Tooltip>
              <Tooltip label="置于底层" shortcut="Ctrl+[">
                <IconButton size="icon-sm" label="置于底层" disabled={!hasSelection} onClick={() => reorderSelection(engine, 'back')}>
                  <SendToBack size={15} />
                </IconButton>
              </Tooltip>
              <Tooltip label="上移一层">
                <IconButton size="icon-sm" label="上移一层" disabled={!hasSelection} onClick={() => reorderSelection(engine, 'forward')}>
                  <ArrowUpToLine size={15} />
                </IconButton>
              </Tooltip>
              <Tooltip label="下移一层">
                <IconButton size="icon-sm" label="下移一层" disabled={!hasSelection} onClick={() => reorderSelection(engine, 'backward')}>
                  <ArrowDownToLine size={15} />
                </IconButton>
              </Tooltip>
            </div>
            <Divider />
            <div className="flex items-center gap-0.5">
              <Tooltip label="复制" shortcut="Ctrl+C">
                <IconButton size="icon-sm" label="复制" disabled={!hasSelection} onClick={() => copySelection(engine)}>
                  <Copy size={15} />
                </IconButton>
              </Tooltip>
              <Tooltip label="再制" shortcut="Ctrl+D">
                <IconButton size="icon-sm" label="再制" disabled={!hasSelection} onClick={() => duplicateSelection(engine)}>
                  <Layers size={15} />
                </IconButton>
              </Tooltip>
              <Tooltip label="删除" shortcut="Del">
                <IconButton size="icon-sm" label="删除" disabled={!hasSelection} onClick={() => deleteSelection(engine)}>
                  <Trash2 size={15} />
                </IconButton>
              </Tooltip>
            </div>
            <Divider />
            <span className="px-1 text-[12px] text-content-secondary">
              {hasSelection ? `已选 ${selection.length} 个对象` : '点击或框选对象，双击可编辑文字'}
            </span>
            {hasSelection ? (
              <Button size="sm" variant="ghost" onClick={() => engine.setSelection([])}>
                取消选择
              </Button>
            ) : null}
          </>
        )
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="wb-glass pointer-events-auto flex max-w-[min(1180px,92vw)] flex-wrap items-center justify-center gap-3 rounded-3xl px-3.5 py-2.5 animate-slide-up">
        {body()}
      </div>
    </div>
  )
}
