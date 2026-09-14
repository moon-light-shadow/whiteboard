import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, FileUp, HardDrive, Loader2, Moon, Pencil, Plus, Search, Sun, Trash2 } from 'lucide-react'
import type { BoardMeta } from '../../kernel/types'
import { getRepository, uniqueName, type BoardDocument } from '../../persist'
import { useUiStore } from '../../store/ui-store'
import { cn } from '../primitives/cn'
import { Button, IconButton } from '../primitives/Button'
import { Dialog } from '../primitives/Dialog'
import { Tooltip } from '../primitives/Tooltip'

export interface BoardLibraryProps {
  onOpen: (doc: BoardDocument) => void
}

const DEFAULT_NAME = '未命名白板'
const NEW_KEY = '__new__'
const IMPORT_KEY = '__import__'

function formatUpdated(at: number): string {
  const diff = Date.now() - at
  if (diff < 60_000) return '刚刚编辑'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前编辑`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前编辑`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前编辑`
  const date = new Date(at)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} 编辑`
}

function describeCount(count: number): string {
  return count > 0 ? `${count} 个对象` : '空白白板'
}

/** 白板库：本地白板列表，支持新建、导入、重命名、复制与删除 */
export function BoardLibrary({ onOpen }: BoardLibraryProps) {
  const repository = useMemo(() => getRepository(), [])
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const showToast = useUiStore((state) => state.showToast)

  const [metas, setMetas] = useState<BoardMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<BoardMeta | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [removing, setRemoving] = useState<BoardMeta | null>(null)

  const refresh = useCallback(async () => {
    try {
      setMetas(await repository.list())
    } catch (error) {
      console.error('读取白板列表失败', error)
      showToast('读取白板列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [repository, showToast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const names = useMemo(() => metas.map((meta) => meta.name), [metas])
  const keyword = query.trim().toLowerCase()
  const visible = keyword ? metas.filter((meta) => meta.name.toLowerCase().includes(keyword)) : metas

  const open = async (meta: BoardMeta) => {
    setBusy(meta.id)
    try {
      const doc = await repository.load(meta.id)
      if (!doc) {
        showToast('白板文件缺失或已损坏', 'error')
        await refresh()
        return
      }
      onOpen(doc)
    } catch (error) {
      console.error('打开白板失败', error)
      showToast('打开白板失败', 'error')
    } finally {
      setBusy(null)
    }
  }

  const create = async () => {
    setBusy(NEW_KEY)
    try {
      const doc = await repository.create(uniqueName(DEFAULT_NAME, names))
      await refresh()
      onOpen(doc)
    } catch (error) {
      console.error('新建白板失败', error)
      showToast('新建白板失败', 'error')
    } finally {
      setBusy(null)
    }
  }

  const importScene = async () => {
    setBusy(IMPORT_KEY)
    try {
      const doc = await repository.pickDocument()
      if (!doc) return
      await repository.save(doc, null)
      await refresh()
      onOpen(doc)
    } catch (error) {
      console.error('导入失败', error)
      showToast('导入失败，请检查文件格式', 'error')
    } finally {
      setBusy(null)
    }
  }

  const duplicate = async (meta: BoardMeta) => {
    setBusy(meta.id)
    try {
      const source = await repository.load(meta.id)
      if (!source) {
        showToast('白板文件缺失或已损坏', 'error')
        return
      }
      const copy = await repository.duplicate(source, uniqueName(`${meta.name} 副本`, names))
      await refresh()
      showToast(`已创建「${copy.name}」`, 'success')
    } catch (error) {
      console.error('复制白板失败', error)
      showToast('复制白板失败', 'error')
    } finally {
      setBusy(null)
    }
  }

  const startRename = (meta: BoardMeta) => {
    setRenaming(meta)
    setRenameValue(meta.name)
  }

  const confirmRename = async () => {
    const target = renaming
    if (!target) return
    const next = renameValue.trim()
    setRenaming(null)
    if (!next || next === target.name) return
    try {
      await repository.rename(target.id, next)
      await refresh()
      showToast('已重命名', 'success')
    } catch (error) {
      console.error('重命名失败', error)
      showToast('重命名失败', 'error')
    }
  }

  const confirmRemove = async () => {
    const target = removing
    if (!target) return
    setRemoving(null)
    try {
      await repository.remove(target.id)
      await refresh()
      showToast(`已删除「${target.name}」`, 'success')
    } catch (error) {
      console.error('删除失败', error)
      showToast('删除失败', 'error')
    }
  }

  return (
    <div className="wb-scroll h-full overflow-y-auto bg-surface-base">
      <div className="mx-auto w-full max-w-[1180px] px-6 pb-16 pt-8 sm:px-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-[0_8px_20px_-10px_rgba(79,70,229,0.9)]">
                <Pencil size={17} />
              </span>
              <h1 className="text-[19px] font-semibold tracking-tight text-content-primary">白板库</h1>
            </div>
            <p className="mt-2 text-[12.5px] text-content-secondary">
              无限画布 · 本地优先存储 · 数据保存在{repository.label}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索白板名称"
                className="wb-focus h-9 w-[210px] rounded-2xl border border-surface-border bg-surface-raised pl-[34px] pr-3 text-[12.5px] text-content-primary outline-none transition-colors duration-150 placeholder:text-content-muted focus:border-brand-400"
              />
            </div>
            <Tooltip label={theme === 'dark' ? '切换到浅色' : '切换到深色'} side="bottom">
              <IconButton label="切换主题" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </IconButton>
            </Tooltip>
            <Button variant="secondary" size="lg" onClick={importScene} disabled={busy !== null}>
              {busy === IMPORT_KEY ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
              导入场景
            </Button>
            <Button variant="primary" size="lg" onClick={create} disabled={busy !== null}>
              {busy === NEW_KEY ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              新建白板
            </Button>
          </div>
        </header>

        <div className="mt-7">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-[12.5px] text-content-muted">
              <Loader2 size={15} className="animate-spin" />
              正在读取白板…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-surface-border bg-surface-raised px-6 py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-sunken text-content-secondary">
                <HardDrive size={20} />
              </span>
              <p className="mt-4 text-[14px] font-semibold text-content-primary">
                {keyword ? '没有匹配的白板' : '还没有任何白板'}
              </p>
              <p className="mt-1.5 max-w-[380px] text-[12.5px] leading-relaxed text-content-secondary">
                {keyword
                  ? '换个关键词试试，或清空搜索条件查看全部白板。'
                  : '新建一块空白白板开始书写，或者导入已有的场景文件继续编辑。'}
              </p>
              <div className="mt-5 flex items-center gap-2">
                {keyword ? (
                  <Button variant="secondary" size="lg" onClick={() => setQuery('')}>
                    清空搜索
                  </Button>
                ) : null}
                <Button variant="primary" size="lg" onClick={create} disabled={busy !== null}>
                  <Plus size={15} />
                  新建白板
                </Button>
                <Button variant="ghost" size="lg" onClick={importScene} disabled={busy !== null}>
                  <FileUp size={15} />
                  导入场景
                </Button>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((meta) => (
                <li key={meta.id}>
                  <article
                    role="button"
                    tabIndex={0}
                    aria-label={`打开 ${meta.name}`}
                    onClick={() => {
                      if (busy) return
                      void open(meta)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        if (!busy) void open(meta)
                      }
                    }}
                    className={cn(
                      'wb-focus group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-raised transition-all duration-150 ease-swift hover:-translate-y-0.5 hover:shadow-float',
                      busy === meta.id && 'opacity-70',
                    )}
                  >
                    <div className="relative flex h-[136px] items-center justify-center overflow-hidden border-b border-surface-border bg-surface-sunken">
                      {meta.thumbnail ? (
                        <img src={meta.thumbnail} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span
                          className="absolute inset-0"
                          style={{
                            backgroundImage:
                              'radial-gradient(circle at 1px 1px, var(--wb-dot) 1px, transparent 0)',
                            backgroundSize: '18px 18px',
                          }}
                        />
                      )}
                      {busy === meta.id ? (
                        <span
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: 'color-mix(in srgb, var(--wb-surface-base) 72%, transparent)' }}
                        >
                          <Loader2 size={18} className="animate-spin text-content-secondary" />
                        </span>
                      ) : null}
                      <div
                        className={cn(
                          'absolute right-2 top-2 flex items-center gap-1 transition-opacity duration-150',
                          'opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100',
                        )}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Tooltip label="重命名" side="bottom">
                          <IconButton
                            label={`重命名 ${meta.name}`}
                            variant="secondary"
                            size="icon-sm"
                            disabled={busy !== null}
                            className="shadow-panel"
                            onClick={() => startRename(meta)}
                          >
                            <Pencil size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip label="创建副本" side="bottom">
                          <IconButton
                            label={`创建 ${meta.name} 的副本`}
                            variant="secondary"
                            size="icon-sm"
                            disabled={busy !== null}
                            className="shadow-panel"
                            onClick={() => void duplicate(meta)}
                          >
                            <Copy size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip label="删除" side="bottom">
                          <IconButton
                            label={`删除 ${meta.name}`}
                            variant="secondary"
                            size="icon-sm"
                            disabled={busy !== null}
                            className="text-rose-500 shadow-panel hover:text-rose-600"
                            onClick={() => setRemoving(meta)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-1 px-3.5 py-3">
                      <h2 className="truncate text-[13px] font-semibold text-content-primary">{meta.name}</h2>
                      <p className="text-[11.5px] text-content-muted">
                        {describeCount(meta.recordCount)} · {formatUpdated(meta.updatedAt)}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="重命名白板"
        width="w-[440px]"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void confirmRename()}>
              保存名称
            </Button>
          </>
        }
      >
        <input
          autoFocus
          value={renameValue}
          maxLength={60}
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') void confirmRename()
          }}
          placeholder="例如：产品评审会白板"
          className="wb-focus h-11 w-full rounded-2xl border border-surface-border bg-surface-sunken px-3.5 text-[14px] font-medium text-content-primary outline-none transition-colors duration-150 focus:border-brand-400"
        />
      </Dialog>

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="删除白板"
        description="删除后该白板及其图片资源都会被移除，且无法恢复"
        width="w-[440px]"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={() => void confirmRemove()}>
              <Trash2 size={15} />
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-content-secondary">
          即将删除「<span className="font-semibold text-content-primary">{removing?.name}</span>」。
        </p>
      </Dialog>
    </div>
  )
}
