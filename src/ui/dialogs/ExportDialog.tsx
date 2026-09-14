import { useEffect, useMemo, useState } from 'react'
import { Check, ClipboardCopy, Download, Loader2 } from 'lucide-react'
import { getRepository } from '../../persist'
import { useBoardStore } from '../../store/board-store'
import { useUiStore } from '../../store/ui-store'
import { buildExport, buildPreview, sanitizeFileName, timestampSuffix, type ExportFormat, type ExportScope } from '../../export'
import { Button } from '../primitives/Button'
import { Dialog } from '../primitives/Dialog'
import { Segmented } from '../primitives/Segmented'
import { useEngine } from '../canvas/engine-context'

export interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

const FORMATS: Array<{ value: ExportFormat; label: string; hint: string }> = [
  { value: 'png', label: 'PNG', hint: '位图，适合分享与插入文档' },
  { value: 'svg', label: 'SVG', hint: '矢量，可无损缩放' },
  { value: 'pdf', label: 'PDF', hint: '适合打印与归档' },
]

const SCALES = [
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '4', label: '4x' },
]

/** 导出面板：范围 / 格式 / 倍率 / 透明背景 + 实时预览 */
export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const engine = useEngine()
  const boardName = useBoardStore((state) => state.boardName)
  const selection = useBoardStore((state) => state.selection)
  const showToast = useUiStore((state) => state.showToast)
  const [scope, setScope] = useState<ExportScope>('board')
  const [format, setFormat] = useState<ExportFormat>('png')
  const [scale, setScale] = useState('2')
  const [transparent, setTransparent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const hasSelection = selection.length > 0

  useEffect(() => {
    if (!open) return
    setScope(hasSelection ? 'selection' : 'board')
    setDone(false)
    setBusy(false)
  }, [open, hasSelection])

  const preview = useMemo(() => {
    if (!open) return null
    return buildPreview(engine.scene, selection, { scope, isDark: engine.isDark() })
  }, [open, engine, selection, scope, format])

  const run = () => {
    setBusy(true)
    const request = { format, scope, scale: Number(scale), transparent, isDark: engine.isDark() }
    buildExport(engine.scene, selection, request)
      .then((payload) =>
        getRepository().saveFile(
          `${sanitizeFileName(boardName)}-${timestampSuffix()}.${payload.extension}`,
          payload.bytes,
          payload.mime,
          format.toUpperCase(),
        ),
      )
      .then((saved) => {
        if (!saved) return
        setDone(true)
        showToast('导出成功', 'success')
        window.setTimeout(onClose, 600)
      })
      .catch((error) => {
        console.error('导出失败', error)
        showToast('导出失败，请重试', 'error')
      })
      .finally(() => setBusy(false))
  }

  const copy = () => {
    setBusy(true)
    buildExport(engine.scene, selection, { format: 'png', scope, scale: 2, transparent, isDark: engine.isDark() })
      .then(async (payload) => {
        const blob = new Blob([payload.bytes.slice().buffer as ArrayBuffer], { type: 'image/png' })
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        showToast('已复制到剪贴板', 'success')
      })
      .catch((error) => {
        console.error('复制失败', error)
        showToast('当前环境不支持写入剪贴板', 'error')
      })
      .finally(() => setBusy(false))
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="导出白板"
      description="导出内容与屏幕上看到的一致，包含便签、图形与手写笔迹"
      width="w-[720px]"
      footer={
        <>
          <Button variant="ghost" onClick={copy} disabled={busy}>
            <ClipboardCopy size={15} />
            复制到剪贴板
          </Button>
          <Button variant="primary" onClick={run} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : done ? <Check size={15} /> : <Download size={15} />}
            {done ? '已导出' : '导出'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_240px]">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[11.5px] font-semibold text-content-secondary">导出范围</p>
            <Segmented
              full
              value={scope}
              onChange={(value) => setScope(value)}
              options={[
                { value: 'board', label: '整块白板' },
                {
                  value: 'selection',
                  label: hasSelection ? `选区（${selection.length} 个对象）` : '选区（未选择）',
                  hint: hasSelection ? undefined : '请先在画布中选择对象',
                },
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-[11.5px] font-semibold text-content-secondary">格式</p>
            <Segmented full value={format} onChange={(value) => setFormat(value)} options={FORMATS} />
            <p className="mt-1.5 text-[11.5px] text-content-muted">{FORMATS.find((item) => item.value === format)?.hint}</p>
          </div>

          {format !== 'svg' ? (
            <div>
              <p className="mb-2 text-[11.5px] font-semibold text-content-secondary">倍率</p>
              <Segmented full value={scale} onChange={setScale} options={SCALES} />
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setTransparent(!transparent)}
            className="flex w-full items-center justify-between rounded-2xl border border-surface-border px-3.5 py-3 text-left transition-colors duration-150 hover:bg-surface-hover"
          >
            <span>
              <span className="block text-[12.5px] font-medium text-content-primary">透明背景</span>
              <span className="mt-0.5 block text-[11.5px] text-content-muted">开启后不绘制底色，适合叠加到其他材料</span>
            </span>
            <span
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${transparent ? 'bg-brand-500' : 'bg-surface-sunken'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${transparent ? 'translate-x-4.5' : 'translate-x-0.5'}`}
              />
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[11.5px] font-semibold text-content-secondary">预览</p>
          <div className="flex min-h-[180px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-surface-border bg-surface-sunken p-3">
            {preview ? (
              <img
                src={preview.dataUrl}
                alt="导出预览"
                className="max-h-[220px] w-full rounded-lg object-contain shadow-panel"
                style={transparent ? { background: 'repeating-conic-gradient(rgba(148,163,184,0.35) 0% 25%, transparent 0% 50%) 50% / 12px 12px' } : undefined}
              />
            ) : null}
          </div>
          {preview ? (
            <p className="text-center text-[11px] tabular-nums text-content-muted">
              {preview.width} × {preview.height} 世界单位 · {preview.count} 个对象
            </p>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
