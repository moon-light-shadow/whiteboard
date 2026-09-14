import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from './cn'
import { IconButton } from './Button'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
  /** 点击遮罩是否关闭，默认 true */
  dismissOnBackdrop?: boolean
}

/** 通用模态框：毛玻璃遮罩 + 缩放淡入动画 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'w-[520px]',
  dismissOnBackdrop = true,
}: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-slate-900/28 backdrop-blur-[3px] animate-fade-in dark:bg-black/55"
        onClick={dismissOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[86vh] max-w-[92vw] flex-col overflow-hidden rounded-3xl bg-surface-raised shadow-pop animate-scale-in',
          'ring-1 ring-surface-border',
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-content-primary">{title}</h2>
            {description ? <p className="mt-1 text-[12px] text-content-secondary">{description}</p> : null}
          </div>
          <IconButton label="关闭" size="icon-sm" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="wb-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-surface-border px-5 py-3.5">{footer}</footer>
        ) : null}
      </div>
    </div>
  )
}
