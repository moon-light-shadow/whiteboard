import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'outline' | 'dark'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_6px_18px_-8px_rgba(79,70,229,0.7)] hover:from-brand-400 hover:to-brand-500 hover:shadow-[0_10px_26px_-10px_rgba(79,70,229,0.8)]',
  secondary: 'bg-surface-raised text-content-primary border border-surface-border hover:bg-surface-hover',
  ghost: 'text-content-secondary hover:bg-surface-hover hover:text-content-primary',
  subtle: 'bg-surface-hover text-content-primary hover:bg-surface-sunken',
  danger: 'bg-rose-500/12 text-rose-500 hover:bg-rose-500/22',
  outline: 'border border-surface-border text-content-primary hover:bg-surface-hover',
  dark: 'bg-[#0f172a] text-white hover:bg-[#1e293b] dark:bg-white dark:text-[#0b1220] dark:hover:bg-slate-100',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 rounded-lg px-2.5 text-[12px]',
  md: 'h-8 gap-2 rounded-[10px] px-3 text-[13px]',
  lg: 'h-10 gap-2 rounded-xl px-4 text-[13px]',
  icon: 'h-9 w-9 rounded-[11px]',
  'icon-sm': 'h-8 w-8 rounded-[10px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  active?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', active = false, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-150 ease-swift active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        active && 'bg-brand-500/14 text-brand-600 dark:text-brand-300 ring-1 ring-brand-500/35',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

export interface IconButtonProps extends ButtonProps {
  label: string
}

/** 图标按钮：统一提供无障碍标签 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'icon', variant = 'ghost', className, children, ...rest },
  ref,
) {
  return (
    <Button ref={ref} size={size} variant={variant} aria-label={label} title={label} className={className} {...rest}>
      {children}
    </Button>
  )
})
