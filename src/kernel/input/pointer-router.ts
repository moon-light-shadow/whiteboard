import type { Point } from '../types'
import type { PointerSample } from '../../tools/tool'

export interface PointerHandlers {
  toWorld(screen: Point): Point
  onDown(event: PointerSample): void
  onMove(event: PointerSample): void
  onUp(event: PointerSample): void
  onDoubleClick(event: PointerSample): void
  onWheel(event: WheelEvent, screen: Point): void
  onHover(event: PointerSample): void
  onLeave(): void
}

function screenOf(surface: HTMLElement, event: PointerEvent | WheelEvent): Point {
  const rect = surface.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

/**
 * 指针事件归一化：把浏览器原生事件转换为世界坐标采样，
 * 合并 getCoalescedEvents 提供的高频采样以还原真实笔迹。
 */
export class PointerRouter {
  private surface: HTMLElement
  private handlers: PointerHandlers
  private active = new Map<number, boolean>()
  private disposed = false

  constructor(surface: HTMLElement, handlers: PointerHandlers) {
    this.surface = surface
    this.handlers = handlers
  }

  attach(): void {
    const surface = this.surface
    surface.addEventListener('pointerdown', this.handlePointerDown)
    surface.addEventListener('pointermove', this.handlePointerMove)
    surface.addEventListener('pointerup', this.handlePointerUp)
    surface.addEventListener('pointercancel', this.handlePointerUp)
    surface.addEventListener('pointerleave', this.handlePointerLeave)
    surface.addEventListener('dblclick', this.handleDoubleClick)
    surface.addEventListener('wheel', this.handleWheel, { passive: false })
    surface.addEventListener('contextmenu', preventDefault)
  }

  detach(): void {
    if (this.disposed) return
    this.disposed = true
    const surface = this.surface
    surface.removeEventListener('pointerdown', this.handlePointerDown)
    surface.removeEventListener('pointermove', this.handlePointerMove)
    surface.removeEventListener('pointerup', this.handlePointerUp)
    surface.removeEventListener('pointercancel', this.handlePointerUp)
    surface.removeEventListener('pointerleave', this.handlePointerLeave)
    surface.removeEventListener('dblclick', this.handleDoubleClick)
    surface.removeEventListener('wheel', this.handleWheel)
    surface.removeEventListener('contextmenu', preventDefault)
  }

  get activePointers(): number {
    return this.active.size
  }

  private normalize(event: PointerEvent, includeCoalesced: boolean): PointerSample {
    const screen = screenOf(this.surface, event)
    const totalPressure = event.pressure > 0 ? event.pressure : event.pointerType === 'mouse' ? 0.5 : 0.5
    const coalesced: Point[] = []
    const coalescedPressure: number[] = []
    if (includeCoalesced && typeof event.getCoalescedEvents === 'function') {
      const events = event.getCoalescedEvents()
      for (const item of events) {
        coalesced.push(this.handlers.toWorld(screenOf(this.surface, item)))
        coalescedPressure.push(item.pressure > 0 ? item.pressure : 0.5)
      }
    }
    if (coalesced.length === 0) {
      coalesced.push(this.handlers.toWorld(screen))
      coalescedPressure.push(totalPressure)
    }
    return {
      pointerId: event.pointerId,
      screen,
      world: this.handlers.toWorld(screen),
      pressure: totalPressure,
      pointerType: event.pointerType,
      button: event.button,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      coalesced,
      coalescedPressure,
      time: event.timeStamp,
      isPrimary: event.isPrimary,
    }
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.surface.setPointerCapture?.(event.pointerId)
    this.active.set(event.pointerId, true)
    this.handlers.onDown(this.normalize(event, false))
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.active.has(event.pointerId)) {
      this.handlers.onHover(this.normalize(event, false))
      return
    }
    this.handlers.onMove(this.normalize(event, true))
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.active.has(event.pointerId)) return
    this.active.delete(event.pointerId)
    this.surface.releasePointerCapture?.(event.pointerId)
    this.handlers.onUp(this.normalize(event, false))
  }

  private handlePointerLeave = (): void => {
    if (this.active.size === 0) this.handlers.onLeave()
  }

  private handleDoubleClick = (event: MouseEvent): void => {
    const rect = this.surface.getBoundingClientRect()
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    this.handlers.onDoubleClick({
      pointerId: -1,
      screen,
      world: this.handlers.toWorld(screen),
      pressure: 0.5,
      pointerType: 'mouse',
      button: 0,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      coalesced: [],
      coalescedPressure: [],
      time: event.timeStamp,
      isPrimary: true,
    })
  }

  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault()
    this.handlers.onWheel(event, screenOf(this.surface, event))
  }
}

function preventDefault(event: Event): void {
  event.preventDefault()
}
