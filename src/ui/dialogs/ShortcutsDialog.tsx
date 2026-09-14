import { Dialog } from '../primitives/Dialog'
import { formatKeys, SHORTCUT_GROUPS } from '../../shortcuts/keymap'

export interface ShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

/** 快捷键帮助：分组展示全部可发现的按键 */
export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="快捷键" description="所有操作都可以只用键盘完成" width="w-[760px]">
      <div className="grid gap-5 md:grid-cols-3">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">{group.title}</h3>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={`${group.title}-${item.keys}`} className="flex items-center justify-between gap-3 py-0.5">
                  <span className="text-[12.5px] text-content-secondary">{item.label}</span>
                  <kbd className="shrink-0 rounded-md border border-surface-border bg-surface-sunken px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-content-primary">
                    {formatKeys(item.keys)}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-5 rounded-2xl bg-surface-sunken px-3.5 py-3 text-[12px] leading-relaxed text-content-secondary">
        触控板：双指拖动平移，捏合缩放；手写笔支持压感与倾斜，笔迹粗细随力度变化。按住空格键可随时临时切换到平移工具。
      </p>
    </Dialog>
  )
}
