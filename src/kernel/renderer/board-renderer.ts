import { cameraEquals, cssTransformBetween, viewportRect, type Camera } from '../camera'
import type { Scene } from '../scene'
import type { Rect, RecordId, SceneRecord } from '../types'
import { drawBackground, type BackgroundVariant } from './background'
import { drawRecord as paintRecord } from './draw-record'
import { worldTransform } from './draw-common'

export type OverlayDrawer = (ctx: CanvasRenderingContext2D, camera: Camera) => void

export interface RendererDeps {
  scene: Scene
  getCamera: () => Camera
  isDark: () => boolean
  background: () => BackgroundVariant
}

const CULL_MARGIN = 96
const SETTLE_DELAY = 90

/**
 * 分层渲染器：
 * - L0 背景点阵：相机变化时程序化重绘（开销极低）
 * - L1 已提交内容：仅在场景/相机稳定后重绘，交互过程中通过 CSS 变换即时预览
 * - L2 交互层：草稿笔迹、选区手柄、参考线，每帧重绘
 */
export class BoardRenderer {
  private container: HTMLElement
  private deps: RendererDeps
  private bgCanvas: HTMLCanvasElement
  private contentCanvas: HTMLCanvasElement
  private overlayCanvas: HTMLCanvasElement
  private bgCtx: CanvasRenderingContext2D
  private contentCtx: CanvasRenderingContext2D
  private overlayCtx: CanvasRenderingContext2D
  private resizeObserver: ResizeObserver | null = null
  private frameHandle = 0
  private destroyed = false

  private dpr = 1
  private viewport = { w: 0, h: 0 }
  private paintedCamera: Camera
  private contentDirty = true
  private overlayDirty = true
  private bgDirty = true
  private previewing = false
  private settleTimer: number | null = null

  private draftDrawer: OverlayDrawer | null = null
  private overlayDrawer: OverlayDrawer | null = null
  /** 正在由 DOM 覆盖层编辑的记录：内容层跳过绘制，避免文字重影 */
  private hiddenId: RecordId | null = null

  private frameTimes: number[] = []
  private lastFrameAt = 0
  private _fps = 0

  constructor(container: HTMLElement, deps: RendererDeps) {
    this.container = container
    this.deps = deps
    this.bgCanvas = createLayer('wb-bg')
    this.contentCanvas = createLayer('wb-content')
    this.overlayCanvas = createLayer('wb-overlay')
    container.append(this.bgCanvas, this.contentCanvas, this.overlayCanvas)
    this.bgCtx = this.bgCanvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D
    this.contentCtx = this.contentCanvas.getContext('2d') as CanvasRenderingContext2D
    this.overlayCtx = this.overlayCanvas.getContext('2d') as CanvasRenderingContext2D
    this.paintedCamera = { ...deps.getCamera() }
    this.contentCanvas.style.transformOrigin = '0 0'
    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.frameHandle = requestAnimationFrame(this.tick)
  }

  get canvas(): HTMLCanvasElement {
    return this.overlayCanvas
  }

  get surface(): HTMLElement {
    return this.container
  }

  get fps(): number {
    return this._fps
  }

  get size(): { w: number; h: number } {
    return this.viewport
  }

  setDraftDrawer(drawer: OverlayDrawer | null): void {
    this.draftDrawer = drawer
    this.overlayDirty = true
  }

  setOverlayDrawer(drawer: OverlayDrawer | null): void {
    this.overlayDrawer = drawer
    this.overlayDirty = true
  }

  setHiddenRecord(id: RecordId | null): void {
    if (this.hiddenId === id) return
    this.hiddenId = id
    this.contentDirty = true
    this.overlayDirty = true
  }

  invalidateContent(): void {
    this.contentDirty = true
  }

  invalidateOverlay(): void {
    this.overlayDirty = true
  }

  invalidateAll(): void {
    this.contentDirty = true
    this.overlayDirty = true
    this.bgDirty = true
  }

  /** 世界坐标矩形转屏幕坐标（用于 DOM 覆盖层定位） */
  rectToScreen(rect: Rect, camera: Camera): Rect {
    return {
      x: (rect.x - camera.x) * camera.z,
      y: (rect.y - camera.y) * camera.z,
      w: rect.w * camera.z,
      h: rect.h * camera.z,
    }
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.frameHandle)
    if (this.settleTimer) window.clearTimeout(this.settleTimer)
    this.resizeObserver?.disconnect()
    this.bgCanvas.remove()
    this.contentCanvas.remove()
    this.overlayCanvas.remove()
  }

  private resize(): void {
    const rect = this.container.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    const dpr = window.devicePixelRatio || 1
    if (w === this.viewport.w && h === this.viewport.h && dpr === this.dpr) return
    this.viewport = { w, h }
    this.dpr = dpr
    for (const canvas of [this.bgCanvas, this.contentCanvas, this.overlayCanvas]) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    this.contentCanvas.style.transform = 'none'
    this.previewing = false
    this.contentDirty = true
    this.bgDirty = true
    this.overlayDirty = true
  }

  private tick = (): void => {
    if (this.destroyed) return
    this.frameHandle = requestAnimationFrame(this.tick)
    if (typeof document !== 'undefined' && document.hidden) return

    const now = performance.now()
    if (this.lastFrameAt) {
      this.frameTimes.push(now - this.lastFrameAt)
      if (this.frameTimes.length > 30) this.frameTimes.shift()
      const avg = this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length
      this._fps = avg > 0 ? Math.round(1000 / avg) : 0
    }
    this.lastFrameAt = now

    if (window.devicePixelRatio && Math.abs(window.devicePixelRatio - this.dpr) > 0.01) {
      this.resize()
    }

    const camera = this.deps.getCamera()
    const cameraChanged = !cameraEquals(camera, this.paintedCamera)
    if (cameraChanged) {
      this.bgDirty = true
      if (!this.previewing) {
        this.previewing = true
        this.contentCanvas.style.transform = cssTransformBetween(this.paintedCamera, camera)
      } else {
        this.contentCanvas.style.transform = cssTransformBetween(this.paintedCamera, camera)
      }
      this.scheduleSettle()
    }

    if (this.bgDirty) {
      drawBackground(this.bgCtx, camera, this.viewport, {
        variant: this.deps.background(),
        isDark: this.deps.isDark(),
        dpr: this.dpr,
      })
      this.bgDirty = false
    }

    if (this.contentDirty) {
      this.paintContent(camera)
      this.contentDirty = false
    }

    if (this.overlayDirty || cameraChanged) {
      this.paintOverlay(camera)
      this.overlayDirty = false
    }
  }

  private scheduleSettle(): void {
    if (this.settleTimer) window.clearTimeout(this.settleTimer)
    this.settleTimer = window.setTimeout(() => {
      this.settleTimer = null
      this.contentDirty = true
    }, SETTLE_DELAY)
  }

  private paintContent(camera: Camera): void {
    const ctx = this.contentCtx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.contentCanvas.width, this.contentCanvas.height)
    worldTransform(ctx, camera, this.dpr)
    const view = viewportRect(camera, this.viewport)
    const cull: Rect = {
      x: view.x - CULL_MARGIN,
      y: view.y - CULL_MARGIN,
      w: view.w + CULL_MARGIN * 2,
      h: view.h + CULL_MARGIN * 2,
    }
    const records = this.deps.scene.visible(cull)
    const isDark = this.deps.isDark()
    for (const record of records) {
      if (this.hiddenId && record.id === this.hiddenId) continue
      paintRecord(ctx, record, camera, isDark)
    }
    this.paintedCamera = { ...camera }
    this.previewing = false
    this.contentCanvas.style.transform = 'none'
  }

  private paintOverlay(camera: Camera): void {
    const ctx = this.overlayCtx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height)
    worldTransform(ctx, camera, this.dpr)
    this.draftDrawer?.(ctx, camera)
    this.overlayDrawer?.(ctx, camera)
  }

}

function createLayer(className: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.className = `absolute inset-0 ${className}`
  canvas.style.pointerEvents = 'none'
  return canvas
}
