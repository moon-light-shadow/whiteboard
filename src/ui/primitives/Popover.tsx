import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from './cn'

export interface PopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom'
  className?: string
  panelClassName?: string
}

const ALIGN = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
} as const

const SIDE = {
  top: 'bottom-[calc(100%+10px)]',
  bottom: 'top-[calc(100%+10px)]',
} as const

/** 轻量浮层：锚定在触发器旁，点击外部关闭 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = 'end',
  side = 'bottom',
  className,
  panelClassName,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <span className="inline-flex" onClick={() => onOpenChange(!open)}>
        {trigger}
      </span>
      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute z-[70] min-w-[168px] rounded-2xl bg-surface-raised p-1.5 shadow-pop ring-1 ring-surface-border animate-slide-down',
            SIDE[side],
            ALIGN[align],
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export interface MenuItemProps {
  onSelect: () => void
  children: ReactNode
  shortcut?: string
  danger?: boolean
  disabled?: boolean
}

export function MenuItem({ onSelect, children, shortcut, danger, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center justify-between gap-6 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors duration-150',
        danger
          ? 'text-rose-500 hover:bg-rose-500/12'
          : 'text-content-primary hover:bg-surface-hover',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      <span>{children}</span>
      {shortcut ? <span className="text-[11px] text-content-muted">{shortcut}</span> : null}
    </button>
  )
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-surface-border" />
}
