import type { BoardDocument, BoardRepository } from './repository'

export interface AutosaveOptions {
  repository: BoardRepository
  /** 取当前待保存文档；返回 null 表示暂无活动白板 */
  getDocument: () => BoardDocument | null
  /** 生成缩略图 data URL（可为异步） */
  getThumbnail?: () => Promise<string | null> | string | null
  onSavingChange?: (saving: boolean) => void
  onSaved?: (at: number, thumbnail: string | null) => void
  onError?: (error: unknown) => void
  /** 空闲多久后落盘 */
  delay?: number
}

/**
 * 自动保存控制器：800ms 防抖落盘 + 关闭前强制保存，
 * 保存期间若有新变更则排队补存，保证最终一致。
 */
export class AutosaveController {
  private timer: number | null = null
  private saving = false
  private pending = false
  private disposed = false
  private options: AutosaveOptions
  private delay: number
  private dirty = false

  constructor(options: AutosaveOptions) {
    this.options = options
    this.delay = options.delay ?? 800
  }

  get isDirty(): boolean {
    return this.dirty
  }

  /** 标记有未保存变更 */
  markDirty(): void {
    if (this.disposed) return
    this.dirty = true
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      this.timer = null
      void this.flush()
    }, this.delay)
  }

  /** 立即落盘（关闭窗口、切换白板、手动保存时调用） */
  async flush(): Promise<void> {
    if (this.disposed) return
    if (this.saving) {
      this.pending = true
      return
    }
    if (!this.dirty) return
    const doc = this.options.getDocument()
    if (!doc) {
      this.dirty = false
      return
    }
    this.saving = true
    this.options.onSavingChange?.(true)
    try {
      const thumbnail = this.options.getThumbnail ? await this.options.getThumbnail() : null
      await this.options.repository.save(doc, thumbnail ?? null)
      this.dirty = false
      this.options.onSaved?.(Date.now(), thumbnail ?? null)
    } catch (error) {
      console.error('自动保存失败', error)
      this.options.onError?.(error)
      // 保留 dirty，下一个周期重试
    } finally {
      this.saving = false
      this.options.onSavingChange?.(false)
      if (this.pending) {
        this.pending = false
        this.markDirty()
      }
    }
  }

  /** 注册关闭前的强制保存（beforeunload 无法等待异步写入，这里做尽力而为） */
  attachLifecycle(): () => void {
    const handler = () => {
      if (!this.dirty) return
      const doc = this.options.getDocument()
      if (!doc) return
      void this.options.repository.save(doc, null).catch(() => undefined)
    }
    window.addEventListener('beforeunload', handler)
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void this.flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('beforeunload', handler)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }

  dispose(): void {
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = null
    this.disposed = true
  }
}
