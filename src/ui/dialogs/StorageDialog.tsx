import { useCallback, useEffect, useState } from 'react'
import { FolderInput, FolderOpen, HardDrive, Loader2, RotateCcw } from 'lucide-react'
import {
  applyStorageDir,
  loadStorageInfo,
  pickStorageDir,
  resetStorageDir,
  revealStorageDir,
  supportsStorageLocation,
  type MigrationReport,
  type StorageInfo,
} from '../../persist'
import { useUiStore } from '../../store/ui-store'
import { cn } from '../primitives/cn'
import { Button } from '../primitives/Button'
import { Dialog } from '../primitives/Dialog'

export interface StorageDialogProps {
  open: boolean
  onClose: () => void
  /** 首次启动引导：文案改为引导语气，默认位置作为推荐项 */
  firstRun?: boolean
  /** 目录切换成功后回调，父组件据此重新读取白板列表 */
  onChanged?: (info: StorageInfo) => void
}

/** 把后端抛出的字符串错误统一转成可展示文案 */
function errorText(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return '操作失败'
}

/** 画布存放位置设置：查看当前目录、更换目录、复制迁移、恢复默认 */
export function StorageDialog({ open, onClose, firstRun = false, onChanged }: StorageDialogProps) {
  const showToast = useUiStore((state) => state.showToast)

  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  /** 用户新选中、尚未确认的目录 */
  const [pending, setPending] = useState<string | null>(null)
  const [migrate, setMigrate] = useState(true)
  const [report, setReport] = useState<MigrationReport | null>(null)

  const load = useCallback(async () => {
    if (!supportsStorageLocation()) return
    setLoading(true)
    try {
      setInfo(await loadStorageInfo())
    } catch (error) {
      showToast(errorText(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!open) return
    setPending(null)
    setReport(null)
    setMigrate(true)
    void load()
  }, [open, load])

  const choose = async () => {
    try {
      const dir = await pickStorageDir(info?.dataDir)
      if (!dir) return
      if (info && dir === info.dataDir) {
        showToast('新旧目录相同，无需切换')
        return
      }
      setPending(dir)
      setMigrate(true)
      setReport(null)
    } catch (error) {
      showToast(errorText(error), 'error')
    }
  }

  const apply = async (dir: string, withMigrate: boolean) => {
    setBusy(true)
    try {
      const result = await applyStorageDir(dir, withMigrate)
      setInfo(result.info)
      setReport(result.migration)
      setPending(null)
      onChanged?.(result.info)
      const migration = result.migration
      if (migration && migration.copied > 0) {
        const extra = migration.skipped > 0 ? `，跳过 ${migration.skipped} 块同名白板` : ''
        showToast(`已切换位置，复制 ${migration.copied} 块白板${extra}`, 'success')
      } else if (migration && migration.skipped > 0) {
        showToast(`已切换位置，新目录已存在 ${migration.skipped} 块同名白板，未覆盖`, 'success')
      } else {
        showToast('已切换画布存放位置', 'success')
      }
    } catch (error) {
      showToast(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const restoreDefault = async () => {
    if (!info) return
    setBusy(true)
    try {
      const next = await resetStorageDir()
      setInfo(next)
      setPending(null)
      setReport(null)
      onChanged?.(next)
      showToast('已恢复到默认位置', 'success')
    } catch (error) {
      showToast(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const reveal = async () => {
    try {
      await revealStorageDir()
    } catch (error) {
      showToast(errorText(error), 'error')
    }
  }

  const atDefault = info ? info.dataDir.toLowerCase() === info.defaultDir.toLowerCase() : false
  const canMigrate = (info?.boardCount ?? 0) > 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={firstRun ? '选择画布存放位置' : '画布存放位置'}
      description={
        firstRun
          ? '白板数据保存在本机目录中，可直接备份或换机迁移'
          : '更改后立即生效，白板列表会从新目录重新读取'
      }
      width="w-[600px]"
      dismissOnBackdrop={!firstRun}
      footer={
        firstRun ? (
          <>
            <Button
              variant="secondary"
              disabled={busy || !info}
              onClick={() => void apply(info!.defaultDir, false)}
            >
              使用默认位置
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void choose()}>
              <FolderInput size={15} />
              选择目录…
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onClose}>
            完成
          </Button>
        )
      }
    >
      {!supportsStorageLocation() ? (
        <p className="text-[12.5px] text-content-secondary">当前环境使用应用内置存储，暂不支持自定义目录。</p>
      ) : loading && !info ? (
        <div className="flex items-center justify-center gap-2 py-14 text-[12.5px] text-content-muted">
          <Loader2 size={15} className="animate-spin" />
          正在读取存储位置…
        </div>
      ) : (
        <div className="space-y-4">
          {pending ? (
            <section className="rounded-2xl border border-brand-400/40 bg-brand-500/[0.06] px-3.5 py-3.5">
              <div className="flex items-center gap-2">
                <FolderInput size={14} className="text-brand-500" />
                <span className="text-[12px] font-semibold text-content-primary">新目录</span>
              </div>
              <p className="mt-1.5 break-all font-mono text-[12px] text-content-primary">{pending}</p>
              {canMigrate ? (
                <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl bg-surface-raised px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={migrate}
                    onChange={(event) => setMigrate(event.target.checked)}
                    className="mt-[3px] h-3.5 w-3.5 accent-brand-500"
                  />
                  <span className="text-[12px] leading-relaxed text-content-secondary">
                    把现有 <span className="font-semibold text-content-primary">{info?.boardCount}</span> 块白板复制到新目录
                    <span className="block text-[11.5px] text-content-muted">
                      同名白板会被跳过，不会覆盖新目录里已有的数据
                    </span>
                  </span>
                </label>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                <Button variant="primary" size="sm" disabled={busy} onClick={() => void apply(pending, migrate)}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                  切换到此目录
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPending(null)}>
                  取消
                </Button>
              </div>
            </section>
          ) : null}

          <section>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">当前目录</span>
              <button
                type="button"
                onClick={() => void reveal()}
                className="wb-focus inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium text-brand-500 transition-colors duration-150 hover:bg-brand-500/10"
              >
                <FolderOpen size={13} />
                打开目录
              </button>
            </div>
            <div className="mt-1.5 rounded-2xl border border-surface-border bg-surface-sunken px-3.5 py-3">
              <p className="break-all font-mono text-[12px] leading-relaxed text-content-primary">
                {info?.dataDir ?? '—'}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-content-muted">
                <HardDrive size={12} />
                {info ? `${info.boardCount} 块白板` : ''} · {atDefault ? '默认位置' : '自定义位置'}
              </p>
            </div>
          </section>

          {report ? (
            <p className="rounded-2xl bg-surface-sunken px-3.5 py-2.5 text-[12px] leading-relaxed text-content-secondary">
              迁移结果：复制 {report.copied} 块，跳过 {report.skipped} 块，失败 {report.failed} 块。
              {report.failed > 0 ? ' 失败项多为源文件被占用，可在关闭其他程序后重新复制。' : ''}
            </p>
          ) : null}

          {!pending ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => void choose()}>
                <FolderInput size={15} />
                更换目录…
              </Button>
              {!atDefault ? (
                <Button variant="ghost" disabled={busy} onClick={() => void restoreDefault()}>
                  <RotateCcw size={14} />
                  恢复默认位置
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className={cn('rounded-2xl bg-surface-sunken px-3.5 py-3 text-[12px] leading-relaxed text-content-secondary')}>
            <p>
              白板存放在所选目录下的 <code className="font-mono text-[11.5px] text-content-primary">boards</code> 子目录中，
              每块白板一个文件夹（<code className="font-mono text-[11.5px] text-content-primary">board.json</code> + 图片资源）。
            </p>
            <p className="mt-1.5">
              <span className="font-semibold text-content-primary">换机迁移：</span>
              把整个目录复制到新机器，再在软件里选择同一目录即可，无需导出导入。
            </p>
          </div>
        </div>
      )}
    </Dialog>
  )
}
