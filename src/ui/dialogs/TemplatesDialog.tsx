import { useEffect, useMemo, useState } from 'react'
import { Info, Wand2 } from 'lucide-react'
import { findTemplate, TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory } from '../../templates'
import { cn } from '../primitives/cn'
import { Button } from '../primitives/Button'
import { Dialog } from '../primitives/Dialog'
import { Segmented } from '../primitives/Segmented'
import { useEngine } from '../canvas/engine-context'

export interface TemplatesDialogProps {
  open: boolean
  onClose: () => void
}

type Filter = TemplateCategory | 'all'

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: 'all', label: '全部' },
  ...TEMPLATE_CATEGORIES.map((category) => ({ value: category as Filter, label: category })),
]

/** 模板库：按分类挑选预设场景，套用后可整体撤销 */
export function TemplatesDialog({ open, onClose }: TemplatesDialogProps) {
  const engine = useEngine()
  const [filter, setFilter] = useState<Filter>('all')
  const [recordCount, setRecordCount] = useState(0)

  useEffect(() => {
    if (open) setRecordCount(engine.scene.count)
  }, [open, engine])

  const list = useMemo(
    () => (filter === 'all' ? TEMPLATES : TEMPLATES.filter((template) => template.category === filter)),
    [filter],
  )

  const apply = (id: string) => {
    const template = findTemplate(id)
    if (!template) return
    engine.loadRecords(template.build(), `template:${template.id}`)
    engine.showToast(`已套用「${template.name}」`, 'success')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="模板库"
      description="选中模板会替换当前画布内容，套用后可随时撤销"
      width="w-[860px]"
      footer={
        <>
          {recordCount > 0 ? (
            <span className="mr-auto inline-flex items-center gap-1.5 text-[11.5px] text-content-muted">
              <Info size={13} />
              当前画布已有 {recordCount} 个对象，套用后将全部替换
            </span>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <Segmented value={filter} options={FILTERS} onChange={(value) => setFilter(value)} size="sm" />
        <span className="text-[11.5px] text-content-muted">{list.length} 个模板</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => apply(template.id)}
            className="wb-focus group flex gap-3.5 rounded-2xl border border-surface-border bg-surface-raised p-3.5 text-left transition-all duration-150 ease-swift hover:-translate-y-0.5 hover:border-brand-400/60 hover:shadow-float"
          >
            <span
              className={cn(
                'relative flex h-[68px] w-[96px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br',
                template.accent,
              )}
            >
              <span className="absolute inset-x-2 top-2 h-1.5 rounded-full bg-white/65" />
              <span className="absolute left-2 top-[18px] h-1.5 w-2/3 rounded-full bg-white/45" />
              <Wand2 size={18} className="relative mt-3 text-white/85 drop-shadow" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-content-primary">{template.name}</span>
                <span className="shrink-0 rounded-md bg-surface-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-content-secondary">
                  {template.category}
                </span>
              </span>
              <span className="mt-1 block text-[11.5px] leading-relaxed text-content-secondary">
                {template.description}
              </span>
              <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:text-brand-300">
                套用模板
              </span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}
