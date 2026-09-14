import type { ReactNode } from 'react'
import { cn } from './cn'

export interface TooltipProps {
  label: ReactNode
  shortcut?: string
  side?: 'top' | 'bottom' | 'right' | 'left'
  children: ReactNode
  className?: string
}

const SIDES = {
  top: 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2',
  bottom: 'top-[calc(100%+8px)] left-1/2 -translate-x-1/2',
  right: 'left-[calc(100%+8px)] top-1/2 -translate-y-1/2',
  left: 'right-[calc(100%+8px)] top-1/2 -translate-y-1/2',
} as const

/** 纯 CSS 悬浮提示：不引入额外依赖，随 hover/focus 淡入 */
export function Tooltip({ label, shortcut, side = 'top', children, className }: TooltipProps) {
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-lg bg-[#0f172a] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-pop transition-opacity duration-150 group-hover/tt:opacity-100 dark:bg-[#1e293b] md:block',
          'group-focus-within/tt:opacity-100',
          SIDES[side],
        )}
      >
        {label}
        {shortcut ? <span className="ml-1.5 text-white/55">{shortcut}</span> : null}
      </span>
    </span>
  )
}
