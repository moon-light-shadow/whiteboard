import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Pipette } from 'lucide-react'
import { cn } from './cn'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const FALLBACK_HEX = '#4f46e5'
const PANEL_WIDTH = 268
const RAINBOW_BG =
  'conic-gradient(from 210deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)'

export interface ColorPopoverProps {
  colors: ReadonlyArray<string>
  value: string
  onChange: (color: string) => void
  label?: string
  columns?: number
  className?: string
}

/**
 * 颜色按钮 + 色板浮层。
 *
 * 浮层通过 portal 挂到 body：窄屏下样式栏是横向滚动容器（overflow-x-auto），
 * 面板若放在栏内会被裁掉，手机上点「笔色」将毫无反应。
 */
export function ColorPopover({ colors, value, onChange, label = '颜色', columns = 9, className }: ColorPopoverProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const custom = !colors.includes(value)

  // 打开后按触发器与面板实际尺寸定位，避开视口边缘与滚动容器裁剪
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return

    const place = () => {
      const rect = trigger.getBoundingClientRect()
      const width = panel.offsetWidth || PANEL_WIDTH
      const height = panel.offsetHeight || 180
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8))
      let top = rect.top - height - 10
      if (top < 8) top = Math.min(rect.bottom + 10, window.innerHeight - height - 8)
      setPos({ left, top })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'wb-focus flex h-9 shrink-0 items-center gap-2 rounded-[12px] px-2.5 text-[12px] font-medium transition-colors duration-150',
          open ? 'bg-brand-500/12 text-content-primary ring-1 ring-brand-500/40' : 'text-content-secondary hover:bg-surface-hover',
          className,
        )}
      >
        <span
          className="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-slate-900/15 dark:ring-white/25"
          style={{ background: value === 'transparent' ? 'rgba(148,163,184,0.35)' : value }}
        />
        {label}
      </button>

      {open ? createPortal(panel(), document.body) : null}
    </>
  )

  function panel() {
    return (
      <div
        ref={panelRef}
        style={{ left: pos?.left ?? 8, top: pos?.top ?? 8, width: PANEL_WIDTH }}
        className="fixed z-[100] flex flex-col gap-2.5 rounded-2xl bg-surface-raised p-3 shadow-pop ring-1 ring-surface-border animate-slide-down"
      >
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
                  'relative flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 ease-swift active:scale-110',
                  active
                    ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-raised'
                    : 'ring-1 ring-inset ring-slate-900/12 dark:ring-white/18',
                )}
                style={{ background: color }}
              >
                {active ? (
                  <Check size={14} strokeWidth={3.2} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
                ) : null}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 border-t border-surface-border pt-2.5">
          <label
            title="自定义颜色"
            className={cn(
              'relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full',
              custom
                ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-raised'
                : 'ring-1 ring-inset ring-slate-900/12 dark:ring-white/18',
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
              <Check size={14} strokeWidth={3.2} className="pointer-events-none text-white drop-shadow" />
            ) : (
              <Pipette size={14} strokeWidth={2.6} className="pointer-events-none text-white drop-shadow" />
            )}
          </label>
          <span className="text-[11px] leading-tight text-content-muted">点色环用系统取色器选任意颜色</span>
        </div>
      </div>
    )
  }
}
