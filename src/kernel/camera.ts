import { clamp } from './geometry'
import type { Point, Rect } from './types'

/**
 * 相机：`x`/`y` 为视口左上角对应的世界坐标，`z` 为缩放比例。
 * 世界坐标 -> 屏幕坐标： (p - camera.xy) * z
 */
export interface Camera {
  x: number
  y: number
  z: number
}

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 12
export const DEFAULT_ZOOM = 1

export function createCamera(x = 0, y = 0, z = DEFAULT_ZOOM): Camera {
  return { x, y, z }
}

export function worldToScreen(p: Point, cam: Camera): Point {
  return { x: (p.x - cam.x) * cam.z, y: (p.y - cam.y) * cam.z }
}

export function worldToScreenXY(x: number, y: number, cam: Camera): Point {
  return { x: (x - cam.x) * cam.z, y: (y - cam.y) * cam.z }
}

export function screenToWorld(p: Point, cam: Camera): Point {
  return { x: p.x / cam.z + cam.x, y: p.y / cam.z + cam.y }
}

export function screenToWorldXY(x: number, y: number, cam: Camera): Point {
  return { x: x / cam.z + cam.x, y: y / cam.z + cam.y }
}

/** 屏幕上的一段距离对应的世界距离 */
export function screenLengthToWorld(length: number, cam: Camera): number {
  return length / cam.z
}

/** 以屏幕上某一点为锚点缩放（滚轮缩放、双指捏合） */
export function zoomAt(cam: Camera, factor: number, anchorScreen: Point): Camera {
  const nextZ = clamp(cam.z * factor, MIN_ZOOM, MAX_ZOOM)
  if (nextZ === cam.z) return cam
  const anchorWorld = screenToWorld(anchorScreen, cam)
  return {
    z: nextZ,
    x: anchorWorld.x - anchorScreen.x / nextZ,
    y: anchorWorld.y - anchorScreen.y / nextZ,
  }
}

export function zoomTo(cam: Camera, nextZ: number, anchorScreen: Point): Camera {
  return zoomAt(cam, clamp(nextZ, MIN_ZOOM, MAX_ZOOM) / cam.z, anchorScreen)
}

export function panCamera(cam: Camera, dxScreen: number, dyScreen: number): Camera {
  return { x: cam.x - dxScreen / cam.z, y: cam.y - dyScreen / cam.z, z: cam.z }
}

/** 计算让内容矩形适配视口、并留出内边距的相机 */
export function cameraForRect(target: Rect, viewport: { w: number; h: number }, padding = 64, maxZoom = maxFitZoom()): Camera {
  if (!viewport.w || !viewport.h) return createCamera(target.x, target.y, DEFAULT_ZOOM)
  const w = Math.max(target.w, 1)
  const h = Math.max(target.h, 1)
  const scale = clamp(Math.min((viewport.w - padding * 2) / w, (viewport.h - padding * 2) / h), MIN_ZOOM, maxZoom)
  return {
    x: target.x + w / 2 - viewport.w / 2 / scale,
    y: target.y + h / 2 - viewport.h / 2 / scale,
    z: scale,
  }
}

function maxFitZoom(): number {
  return 2
}

export function cameraEquals(a: Camera, b: Camera): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z
}

/** 当前视口覆盖的世界矩形 */
export function viewportRect(cam: Camera, viewport: { w: number; h: number }): Rect {
  return { x: cam.x, y: cam.y, w: viewport.w / cam.z, h: viewport.h / cam.z }
}

/** CSS 变换：把「已在 oldCam 下绘制好的图层」即时预览为 newCam 的效果（平移缩放期间避免全量重绘） */
export function cssTransformBetween(oldCam: Camera, newCam: Camera): string {
  const k = newCam.z / oldCam.z
  const tx = newCam.z * (oldCam.x - newCam.x)
  const ty = newCam.z * (oldCam.y - newCam.y)
  return `translate(${tx}px, ${ty}px) scale(${k})`
}
