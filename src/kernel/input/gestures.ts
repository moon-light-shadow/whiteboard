import { panCamera, zoomAt, type Camera } from '../camera'
import type { Point } from '../types'

interface TrackedPointer {
  screen: Point
  world: Point
}

/**
 * 手势控制器：识别「双指平移 + 捏合缩放」，
 * 单指时交由当前工具处理，双指时接管为画布导航。
 */
export class GestureController {
  private pointers = new Map<number, TrackedPointer>()
  private pinchAnchor: { center: Point; distance: number; camera: Camera } | null = null
  private pinching = false

  get isPinching(): boolean {
    return this.pinching
  }

  get pointerCount(): number {
    return this.pointers.size
  }

  addPointer(id: number, screen: Point, world: Point, camera: Camera): boolean {
    this.pointers.set(id, { screen, world })
    if (this.pointers.size >= 2 && !this.pinching) {
      const anchor = this.buildAnchor()
      if (!anchor) return false
      this.pinching = true
      this.pinchAnchor = { ...anchor, camera }
      return true
    }
    return false
  }

  updatePointer(id: number, screen: Point, world: Point): { camera: Camera } | null {
    const tracked = this.pointers.get(id)
    if (!tracked) return null
    tracked.screen = screen
    tracked.world = world
    if (!this.pinching || !this.pinchAnchor) return null
    const current = this.buildAnchor()
    if (!current) return null
    const previous = this.pinchAnchor
    let camera = zoomAt(previous.camera, current.distance / Math.max(1, previous.distance), current.center)
    const dx = current.center.x - previous.center.x
    const dy = current.center.y - previous.center.y
    camera = panCamera(camera, dx, dy)
    this.pinchAnchor = { center: current.center, distance: current.distance, camera }
    return { camera }
  }

  removePointer(id: number): boolean {
    this.pointers.delete(id)
    if (this.pointers.size < 2) {
      const wasPinching = this.pinching
      this.pinching = false
      this.pinchAnchor = null
      return wasPinching
    }
    return false
  }

  reset(): void {
    this.pointers.clear()
    this.pinching = false
    this.pinchAnchor = null
  }

  private buildAnchor(): { center: Point; distance: number } | null {
    const list = [...this.pointers.values()]
    if (list.length < 2) return null
    const [a, b] = list
    return {
      center: { x: (a.screen.x + b.screen.x) / 2, y: (a.screen.y + b.screen.y) / 2 },
      distance: Math.hypot(a.screen.x - b.screen.x, a.screen.y - b.screen.y),
    }
  }
}

/** 滚轮：ctrl/⌘ + 滚轮缩放，其余情况平移 */
export function applyWheelNavigation(
  event: WheelEvent,
  screen: Point,
  camera: Camera,
): Camera {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1
  if (event.ctrlKey || event.metaKey) {
    const factor = Math.exp((-event.deltaY * unit) / 300)
    return zoomAt(camera, factor, screen)
  }
  const dx = event.deltaX * unit
  const dy = event.deltaY * unit
  const shiftHorizontal = event.shiftKey && dx === 0
  return panCamera(camera, shiftHorizontal ? dy : dx, shiftHorizontal ? 0 : dy)
}
