import { cn } from './cn'

export interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  /** 显示当前值（可为自定义文案） */
  format?: (value: number) => string
  className?: string
  ariaLabel?: string
}

/** 样式化滑块：轨道 + 品牌色进度填充 */
export function Slider({ value, min, max, step = 1, onChange, format, className, ariaLabel }: SliderProps) {
  const ratio = max === min ? 0 : (value - min) / (max - min)
  const percent = Math.max(0, Math.min(100, ratio * 100))

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <input
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="wb-slider wb-focus h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none"
        style={{
          background: `linear-gradient(to right, var(--wb-selection) 0%, var(--wb-selection) ${percent}%, var(--wb-surface-sunken) ${percent}%, var(--wb-surface-sunken) 100%)`,
        }}
      />
      {format ? (
        <span className="w-9 shrink-0 text-right text-[11px] font-medium tabular-nums text-content-secondary">
          {format(value)}
        </span>
      ) : null}
    </div>
  )
}
