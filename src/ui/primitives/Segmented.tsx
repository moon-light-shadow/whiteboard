import type { ReactNode } from 'react'
import { cn } from './cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  hint?: string
}

export interface SegmentedProps<T extends string> {
  value: T
  options: ReadonlyArray<SegmentedOption<T>>
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
  full?: boolean
}

/** 分段控件：单行互斥选择 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = 'md',
  full = false,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-[13px] border border-surface-border bg-surface-sunken p-1',
        full && 'w-full',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={option.hint ?? option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-medium transition-all duration-150 ease-swift',
              size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-7 px-3 text-[12.5px]',
              active
                ? 'bg-surface-raised text-content-primary shadow-[0_2px_8px_-4px_rgba(15,23,42,0.35)]'
                : 'text-content-secondary hover:text-content-primary',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
