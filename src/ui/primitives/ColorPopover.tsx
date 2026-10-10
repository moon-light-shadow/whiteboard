import { useState } from 'react'
import { Check, Pipette } from 'lucide-react'
import { cn } from './cn'
import { Popover } from './Popover'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const FALLBACK_HEX = '#4f46e5'
const RAINBOW_BG =
  'conic-gradient(from 210deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)'

export interface ColorPopoverProps {
  colors: ReadonlyArray<string>
  value: string
  onChange: (color: string) => void
  /** 触发器上的文字标签 */
  label?: string
  columns?: number
  className?: string
}

/**
 * 颜色按钮 + 浮层色板：工具栏只占一个色块，展开后可选预设色与任意自定义色。
 * 桌面与手机通用（浮层向上弹出，不额外占用画布横向空间）。
 */
export function ColorPopover({ colors, value, onChange, label = '颜色', columns = 9, className }: ColorPopoverProps) {
  const [open, setOpen] = useState(false)
  const custom = !colors.includes(value)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="center"
      side="top"
      className={className}
      panelClassName="w-[276px] p-3"
      trigger={
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          className={cn(
            'wb-focus flex h-8 items-center gap-2 rounded-[12px] px-2 text-[12px] font-medium transition-colors duration-150',
            open ? 'bg-brand-500/12 text-content-primary ring-1 ring-brand-500/40' : 'text-content-secondary hover:bg-surface-hover',
          )}
        >
          <span
            className="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-slate-900/15 dark:ring-white/25"
            style={{ background: value === 'transparent' ? 'rgba(148,163,184,0.35)' : value }}
          />
          {label}
        </button>
      }
    >
      <div className="flex flex-col gap-2.5">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {colors.map((color) => {
            const active = color === value
            return (
              <button
                key={color}
                type="button"
                aria-label={color}
                title={color}
                onClick={() => {
                  onChange(color)
                  setOpen(false)
                }}
                className={cn(
                  'relative flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-150 ease-swift hover:scale-110',
                  active ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-raised' : 'ring-1 ring-inset ring-slate-900/12 dark:ring-white/18',
                )}
                style={{ background: color }}
              >
                {active ? (
                  <Check size={13} strokeWidth={3.2} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
                ) : null}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 border-t border-surface-border pt-2.5">
          <label
            title="自定义颜色"
            className={cn(
              'relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full',
              custom ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-raised' : 'ring-1 ring-inset ring-slate-900/12 dark:ring-white/18',
            )}
            style={{ background: custom ? value : RAINBOW_BG }}
          >
            <input
              type="color"
              aria-label="自定义颜色"
              value={HEX_COLOR.test(value) ? value : FALLBACK_HEX}
              onChange={(event) => onChange(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            {custom ? (
              <Check size={12} strokeWidth={3.2} className="pointer-events-none text-white drop-shadow" />
            ) : (
              <Pipette size={12} strokeWidth={2.6} className="pointer-events-none text-white drop-shadow" />
            )}
          </label>
          <span className="text-[11px] leading-tight text-content-muted">点色环可用系统取色器选任意颜色</span>
        </div>
      </div>
    </Popover>
  )
}
