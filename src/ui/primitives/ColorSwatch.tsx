import { Check, Pipette } from 'lucide-react'
import { cn } from './cn'

export interface ColorGridProps {
  colors: ReadonlyArray<string>
  value: string
  onChange: (color: string) => void
  /** 追加透明选项（形状填充用） */
  allowTransparent?: boolean
  /** 追加取色块：打开系统色盘，可选任意颜色 */
  allowCustom?: boolean
  className?: string
  size?: 'sm' | 'md'
  columns?: number
}

const TRANSPARENT_BG =
  'repeating-conic-gradient(rgba(148,163,184,0.55) 0% 25%, rgba(255,255,255,0.9) 0% 50%) 50% / 10px 10px'
/** 自定义取色块的彩色环，表示"任意颜色" */
const RAINBOW_BG =
  'conic-gradient(from 210deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)'
const FALLBACK_HEX = '#4f46e5'
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** 圆形色块网格：选中态带描边与勾选标记，可选追加透明与自定义色盘 */
export function ColorGrid({
  colors,
  value,
  onChange,
  allowTransparent = false,
  allowCustom = false,
  className,
  size = 'md',
  columns = 8,
}: ColorGridProps) {
  const items = allowTransparent ? ['transparent', ...colors] : [...colors]
  const customActive = allowCustom && value !== 'transparent' && !items.includes(value)
  const swatch = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  const activeRing = 'ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-raised'
  const idleRing = 'ring-1 ring-inset ring-slate-900/12 dark:ring-white/18'

  return (
    <div
      className={cn('grid gap-1.5', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((color) => {
        const active = color === value
        const transparent = color === 'transparent'
        return (
          <button
            key={color}
            type="button"
            aria-label={transparent ? '透明' : color}
            title={transparent ? '透明' : color}
            onClick={() => onChange(color)}
            className={cn(
              'relative flex items-center justify-center rounded-full transition-transform duration-150 ease-swift hover:scale-110',
              swatch,
              active ? activeRing : idleRing,
            )}
            style={transparent ? { background: TRANSPARENT_BG } : { background: color }}
          >
            {active && !transparent ? (
              <Check size={size === 'sm' ? 11 : 13} strokeWidth={3.2} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
            ) : null}
          </button>
        )
      })}
      {allowCustom ? (
        <label
          title="自定义颜色"
          className={cn(
            'relative flex cursor-pointer items-center justify-center overflow-hidden rounded-full transition-transform duration-150 ease-swift hover:scale-110',
            swatch,
            customActive ? activeRing : idleRing,
          )}
          style={{ background: customActive ? value : RAINBOW_BG }}
        >
          {/* 原生色盘：input 铺满色块，点击即可唤起系统取色器 */}
          <input
            type="color"
            aria-label="自定义颜色"
            value={HEX_COLOR.test(value) ? value : FALLBACK_HEX}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          {customActive ? (
            <Check
              size={size === 'sm' ? 11 : 13}
              strokeWidth={3.2}
              className="pointer-events-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
            />
          ) : (
            <Pipette
              size={size === 'sm' ? 10 : 12}
              strokeWidth={2.6}
              className="pointer-events-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
            />
          )}
        </label>
      ) : null}
    </div>
  )
}
