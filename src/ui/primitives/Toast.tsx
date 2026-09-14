import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useUiStore } from '../../store/ui-store'
import { cn } from './cn'

const TONES = {
  info: { icon: Info, className: 'text-sky-400' },
  success: { icon: CheckCircle2, className: 'text-emerald-400' },
  error: { icon: AlertCircle, className: 'text-rose-400' },
} as const

/** 全局提示条：底部居中，自动消失 */
export function ToastHost() {
  const toast = useUiStore((state) => state.toast)
  if (!toast) return null
  const tone = TONES[toast.tone]
  const Icon = tone.icon
  return (
    <div className="pointer-events-none fixed bottom-7 left-1/2 z-[95] -translate-x-1/2">
      <div
        key={toast.id}
        className="flex items-center gap-2 rounded-2xl bg-[#0f172a]/92 px-3.5 py-2.5 text-[12.5px] font-medium text-white shadow-pop backdrop-blur animate-slide-up dark:bg-[#1e293b]/94"
      >
        <Icon size={15} className={tone.className} />
        {toast.message}
      </div>
    </div>
  )
}
