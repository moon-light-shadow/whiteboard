import {
  cameraEquals,
  cameraForRect,
  createCamera,
  panCamera,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Camera,
} from '../../kernel/camera'
import { History } from '../../kernel/history'
import { imageCache } from '../../kernel/image-cache'
import { GestureController, applyWheelNavigation } from '../../kernel/input/gestures'
import { PointerRouter } from '../../kernel/input/pointer-router'
import { BoardRenderer } from '../../kernel/renderer/board-renderer'
import { strokeRecordOutline } from '../../kernel/renderer/draw-common'
import { Scene } from '../../kernel/scene'
import type { ChangeSet, Point, RecordId, SceneRecord } from '../../kernel/types'
import { insertPickedImage } from '../../persist/assets'
import { AutosaveController } from '../../persist/autosave'
import { getRepository, loadAssetUrl, type BoardDocument, type CameraState, type PickedImage, type StorageKind } from '../../persist'
import { useBoardStore } from '../../store/board-store'
import { useToolStore, type ToolId, type ToolStyle } from '../../store/tool-store'
import { useUiStore } from '../../store/ui-store'
import { createToolRegistry } from '../../tools'
import type { PointerSample, Tool, ToolContext } from '../../tools/tool'
import { renderThumbnail } from '../../export/png'
import { recordsForScope, resolveBounds } from '../../export/bounds'

export interface EngineInit {
  container: HTMLElement
  boardId: string
  boardName: string
  createdAt: number
  records: SceneRecord[]
  camera: CameraState | null
}

/**
 * 画布引擎：把场景、历史、相机、渲染器、工具与持久化装配成可交互整体，
 * 同时实现 ToolContext，供各工具反向调用。
 */
export class BoardEngine implements ToolContext {
  readonly scene = new Scene()
  readonly history: History
  readonly renderer: BoardRenderer
  readonly tools: Map<ToolId, Tool>
  readonly boardId: string
  readonly createdAt: number
  readonly storage: StorageKind

  private camera: Camera
  private activeToolId: ToolId
  private pointer: PointerRouter
  private gesture = new GestureController()
  private autosave: AutosaveController
  private disposers: Array<() => void> = []
  private activePointerId: number | null = null
  private navigating = false
  private panLast: Point | null = null
  private spaceHeld = false
  private cameraSync = 0
  private destroyed = false

  constructor(init: EngineInit) {
    this.boardId = init.boardId
    this.createdAt = init.createdAt
    const repository = getRepository()
    this.storage = repository.kind
    this.camera = init.camera ? { ...init.camera } : createCamera(0, 0, 1)
    this.activeToolId = useToolStore.getState().tool
    this.tools = createToolRegistry()

    this.renderer = new BoardRenderer(init.container, {
      scene: this.scene,
      getCamera: () => this.camera,
      isDark: () => useUiStore.getState().theme === 'dark',
      background: () => 'dots',
    })

    this.history = new History(this.scene, {
      getSelection: () => useBoardStore.getState().selection,
      setSelection: (ids) => useBoardStore.getState().setSelection(ids),
    })

    this.scene.load(init.records)
    this.bindScene()
    this.bindStore()
    this.bindImageAssets(repository, init.boardId)
    this.applyTool(this.activeToolId)
    this.renderer.setDraftDrawer((ctx, camera) => {
      this.tools.get(this.activeToolId)?.drawDraft?.(ctx, camera, this)
    })
    // 选中描边与工具无关：Ctrl+A 全选、快捷键改选区等只改状态的路径也要能看到高亮
    this.renderer.setOverlayDrawer((ctx) => {
      const selection = useBoardStore.getState().selection
      if (selection.length === 0) return
      const color = this.isDark() ? '#818cf8' : '#4f46e5'
      ctx.save()
      ctx.globalAlpha = 0.9
      for (const id of selection) {
        const record = this.scene.get(id)
        if (record) strokeRecordOutline(ctx, record, this.camera, { color, width: 1.5 })
      }
      ctx.restore()
    })

    this.autosave = new AutosaveController({
      repository,
      getDocument: () => this.buildDocument(),
      getThumbnail: () => this.buildThumbnail(),
      onSavingChange: (saving) => useBoardStore.getState().setSaving(saving),
      onSaved: (at) => useBoardStore.getState().setLastSavedAt(at),
      onError: () => useUiStore.getState().showToast('保存失败，请检查磁盘空间', 'error'),
    })
    this.disposers.push(this.autosave.attachLifecycle())

    this.pointer = new PointerRouter(this.renderer.surface, {
      toWorld: (screen) => this.toWorld(screen),
      onDown: (event) => this.handleDown(event),
      onMove: (event) => this.handleMove(event),
      onUp: (event) => this.handleUp(event),
      onHover: (event) => this.handleHover(event),
      onDoubleClick: (event) => this.tools.get(this.activeToolId)?.onDoubleClick?.(event, this),
      onWheel: (event, screen) => this.setCamera(applyWheelNavigation(event, screen, this.camera), true),
      onLeave: () => this.applyCursor(),
    })
    this.pointer.attach()
  }

  get cameraState(): Camera {
    return this.camera
  }

  get viewport(): { w: number; h: number } {
    return this.renderer.size
  }

  setSpaceHeld(held: boolean): void {
    this.spaceHeld = held
    if (!this.navigating) this.applyCursor()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.cameraSync) cancelAnimationFrame(this.cameraSync)
    this.pointer.detach()
    this.disposers.forEach((dispose) => dispose())
    this.disposers = []
    void this.autosave.flush().finally(() => this.autosave.dispose())
    const assetIds = this.scene
      .ordered()
      .filter((record) => record.type === 'image')
      .map((record) => record.props.assetId)
    imageCache.releaseAssetIds(assetIds)
    imageCache.setLoader(null)
    this.renderer.destroy()
    this.tools.forEach((tool) => tool.deactivate?.(this))
  }

  // ---------------------------------------------------------------- ToolContext

  getCamera(): Camera {
    return this.camera
  }

  setCamera(camera: Camera, preview = false): void {
    if (cameraEquals(camera, this.camera)) return
    this.camera = camera
    if (!preview) this.renderer.invalidateAll()
    this.scheduleCameraSync()
  }

  getStyle(): ToolStyle {
    return useToolStore.getState()
  }

  getToolId(): ToolId {
    return this.activeToolId
  }

  setTool(tool: ToolId): void {
    useToolStore.getState().setTool(tool)
  }

  getSelection(): RecordId[] {
    return useBoardStore.getState().selection
  }

  setSelection(ids: RecordId[], options?: { additive?: boolean; silent?: boolean }): void {
    const store = useBoardStore.getState()
    if (options?.additive) store.addToSelection(ids)
    else store.setSelection(ids)
    if (!options?.silent) this.history.setLastSelection(ids)
  }

  commit(change: ChangeSet, options?: { merge?: boolean }): void {
    this.history.push(change, options?.merge ?? false)
  }

  applyBatch(change: ChangeSet, options?: { merge?: boolean }): void {
    this.scene.commitChange(change)
    this.history.push(change, options?.merge ?? false)
  }

  requestRender(): void {
    this.renderer.invalidateContent()
    this.renderer.invalidateOverlay()
  }

  requestOverlay(): void {
    this.renderer.invalidateOverlay()
  }

  toScreen(point: Point): Point {
    return worldToScreen(point, this.camera)
  }

  toWorld(point: Point): Point {
    return screenToWorld(point, this.camera)
  }

  isDark(): boolean {
    return useUiStore.getState().theme === 'dark'
  }

  showToast(message: string, tone: 'info' | 'success' | 'error' = 'info'): void {
    useUiStore.getState().showToast(message, tone)
  }

  startEditing(id: RecordId, options?: { selectAll?: boolean; caretToEnd?: boolean; isNew?: boolean }): void {
    useBoardStore.getState().startEditing({
      id,
      selectAll: options?.selectAll ?? true,
      caretToEnd: options?.caretToEnd ?? false,
      isNew: options?.isNew ?? false,
    })
  }

  async importImageAt(world: Point): Promise<void> {
    const repository = getRepository()
    const picked = await repository.pickImages()
    if (picked.length === 0) return
    await this.insertImages(picked.map((item) => item), world)
  }

  /** 插入若干图片（工具选择文件、拖拽、粘贴共用） */
  async insertImages(picked: PickedImage[], world: Point): Promise<void> {
    const repository = getRepository()
    const records: SceneRecord[] = []
    for (let index = 0; index < picked.length; index += 1) {
      const record = await insertPickedImage(repository, this.boardId, picked[index], world, index)
      if (record) records.push(record)
    }
    if (records.length === 0) return
    this.commit(this.scene.add(records, 'add:image'))
    this.setSelection(records.map((record) => record.id))
    this.showToast(`已插入 ${records.length} 张图片`, 'success')
  }

  hitTest(world: Point, tolerance = 6): SceneRecord | null {
    return this.scene.hitTest(world, tolerance)
  }

  /** 标记有未保存变更（模板套用、场景导入等绕过场景事务的修改） */
  markDirty(): void {
    useBoardStore.getState().setDirty(true)
    this.autosave.markDirty()
  }

  /** 批量插入记录并选中它们 */
  insertRecords(records: SceneRecord[], label: string, select = true): void {
    if (records.length === 0) return
    this.commit(this.scene.add(records, label))
    if (select) this.setSelection(records.map((record) => record.id))
  }

  /** 整体替换场景内容（套用模板、导入场景文件），并保留一次可撤销记录 */
  loadRecords(records: SceneRecord[], label = 'template'): void {
    const before = this.scene.ordered()
    this.scene.load(records)
    if (before.length > 0 || records.length > 0) {
      this.history.push({ label, added: this.scene.ordered(), updated: [], removed: before })
    }
    useBoardStore.getState().setSelection([])
    useBoardStore.getState().stopEditing()
    this.renderer.setHiddenRecord(null)
    this.markDirty()
    this.fitToContent()
  }

  // ---------------------------------------------------------------- 工具与光标

  private applyTool(toolId: ToolId): void {
    const previous = this.tools.get(this.activeToolId)
    if (previous && previous.id !== toolId) previous.deactivate?.(this)
    this.activeToolId = toolId
    const next = this.tools.get(toolId)
    next?.activate?.(this)
    this.applyCursor()
    this.renderer.invalidateOverlay()
  }

  private applyCursor(): void {
    if (this.navigating) {
      this.renderer.surface.style.cursor = this.panLast ? 'grabbing' : 'grab'
      return
    }
    if (this.spaceHeld) {
      this.renderer.surface.style.cursor = 'grab'
      return
    }
    this.renderer.surface.style.cursor = this.tools.get(this.activeToolId)?.cursor ?? 'default'
  }

  private activeTool(): Tool | undefined {
    return this.tools.get(this.activeToolId)
  }

  // ---------------------------------------------------------------- 指针事件

  private handleDown(event: PointerSample): void {
    useUiStore.getState().closeContextMenu()
    const pinching = this.gesture.addPointer(event.pointerId, event.screen, event.world, this.camera)
    if (pinching) {
      this.activeTool()?.deactivate?.(this)
      this.activePointerId = null
      this.navigating = true
      this.panLast = event.screen
      this.applyCursor()
      return
    }
    if (this.navigating) return

    if (event.button === 2) {
      this.openContextMenuAt(event)
      return
    }
    if (this.spaceHeld || event.button === 1) {
      this.navigating = true
      this.panLast = event.screen
      this.applyCursor()
      return
    }
    if (event.button !== 0 && event.pointerType === 'mouse') return
    this.activePointerId = event.pointerId
    this.activeTool()?.onPointerDown?.(event, this)
  }

  private handleMove(event: PointerSample): void {
    const gesture = this.gesture.updatePointer(event.pointerId, event.screen, event.world)
    if (gesture) {
      this.setCamera(gesture.camera, true)
      return
    }
    if (this.navigating) {
      if (this.panLast) {
        this.setCamera(panCamera(this.camera, event.screen.x - this.panLast.x, event.screen.y - this.panLast.y), true)
        this.panLast = event.screen
      }
      return
    }
    if (this.activePointerId !== event.pointerId) return
    this.activeTool()?.onPointerMove?.(event, this)
  }

  private handleUp(event: PointerSample): void {
    const wasPinching = this.gesture.removePointer(event.pointerId)
    if (this.navigating) {
      if (this.gesture.pointerCount === 0) {
        this.navigating = false
        this.panLast = null
        this.renderer.invalidateAll()
        this.applyCursor()
      } else {
        this.panLast = event.screen
      }
      return
    }
    if (wasPinching) return
    if (this.activePointerId === event.pointerId) {
      this.activePointerId = null
      this.activeTool()?.onPointerUp?.(event, this)
    }
  }

  private handleHover(event: PointerSample): void {
    if (this.activePointerId !== null) return
    const tool = this.activeTool()
    tool?.onPointerMove?.(event, this)
    if (!tool || this.navigating || this.spaceHeld) return
    const cursor = tool.cursorFor?.(event.world, this)
    if (cursor) this.renderer.surface.style.cursor = cursor
    else this.applyCursor()
  }

  private openContextMenuAt(event: PointerSample): void {
    const tolerance = 8 / this.camera.z
    const target = this.scene.hitTest(event.world, tolerance)
    if (target && !this.getSelection().includes(target.id)) this.setSelection([target.id])
    useUiStore.getState().openContextMenu({
      x: event.screen.x,
      y: event.screen.y,
      world: event.world,
      targetId: target?.id ?? null,
    })
  }

  // ---------------------------------------------------------------- 相机指令

  zoomBy(factor: number, anchorScreen?: Point): void {
    const anchor = anchorScreen ?? { x: this.renderer.size.w / 2, y: this.renderer.size.h / 2 }
    this.setCamera(zoomAt(this.camera, factor, anchor))
  }

  zoomToPercent(percent: number): void {
    const next = Math.max(0.05, Math.min(12, percent / 100))
    this.zoomBy(next / this.camera.z)
  }

  fitToContent(padding = 72): void {
    const bounds = this.scene.bounds()
    const size = this.renderer.size
    if (!bounds) {
      this.setCamera(cameraForRect({ x: 0, y: 0, w: 960, h: 600 }, size, padding))
      return
    }
    this.setCamera(cameraForRect(bounds, size, padding))
  }

  /** 首次打开且没有历史相机时，自动把内容居中 */
  fitOnFirstOpen(): void {
    const hasCamera = this.camera.x !== 0 || this.camera.y !== 0 || this.camera.z !== 1
    if (hasCamera) return
    this.fitToContent()
  }

  // ---------------------------------------------------------------- 内部装配

  private bindScene(): void {
    this.disposers.push(
      this.scene.subscribe((_change, origin) => {
        this.renderer.invalidateContent()
        this.renderer.setHiddenRecord(useBoardStore.getState().editing?.id ?? null)
        if (origin !== 'load') {
          useBoardStore.getState().setDirty(true)
          this.autosave?.markDirty()
        }
      }),
      this.history.subscribe((state) => useBoardStore.getState().setHistory(state)),
    )
  }

  private bindStore(): void {
    let previousTool = this.activeToolId
    let previousEditing = useBoardStore.getState().editing
    let previousSelection = useBoardStore.getState().selection
    let previousTheme = useUiStore.getState().theme
    const unsubscribe = useToolStore.subscribe((state) => {
      if (state.tool === previousTool) return
      previousTool = state.tool
      this.applyTool(state.tool)
    })
    const unsubscribeBoard = useBoardStore.subscribe((state) => {
      // 选区变化必须重绘交互层，否则只改选区的命令（Ctrl+A 等）看不到选区
      if (state.selection !== previousSelection) {
        previousSelection = state.selection
        this.renderer.invalidateOverlay()
      }
      if (state.editing === previousEditing) return
      previousEditing = state.editing
      this.renderer.setHiddenRecord(state.editing?.id ?? null)
    })
    const unsubscribeUi = useUiStore.subscribe((state) => {
      if (state.theme === previousTheme) return
      previousTheme = state.theme
      this.renderer.invalidateAll()
    })
    this.disposers.push(unsubscribe, unsubscribeBoard, unsubscribeUi)
  }

  private bindImageAssets(repository: ReturnType<typeof getRepository>, boardId: string): void {
    imageCache.setLoader((assetId) => loadAssetUrl(repository, boardId, assetId))
    this.disposers.push(
      imageCache.onLoad(() => this.renderer.invalidateContent()),
      () => imageCache.setLoader(null),
    )
  }

  private scheduleCameraSync(): void {
    if (this.cameraSync) return
    this.cameraSync = requestAnimationFrame(() => {
      this.cameraSync = 0
      if (!this.destroyed) useBoardStore.getState().bumpCamera()
    })
  }

  private buildDocument(): BoardDocument {
    const store = useBoardStore.getState()
    return {
      id: this.boardId,
      name: store.boardName,
      createdAt: this.createdAt,
      updatedAt: Date.now(),
      camera: { ...this.camera },
      records: this.scene.ordered(),
    }
  }

  private buildThumbnail(): string {
    const records = recordsForScope(this.scene, [], 'board')
    return renderThumbnail(records, resolveBounds(records, 24), this.isDark(), 420)
  }

  /** 手动保存（Ctrl+S / 关闭前） */
  async saveNow(): Promise<void> {
    this.autosave.markDirty()
    await this.autosave.flush()
  }
}
