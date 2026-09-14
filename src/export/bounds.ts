import { recordBounds, unionRects } from '../kernel/geometry'
import type { Scene } from '../kernel/scene'
import type { RecordId, Rect, SceneRecord } from '../kernel/types'

export type ExportScope = 'board' | 'selection'

/** 导出画布的最大像素边长，避免超出浏览器画布上限 */
export const MAX_CANVAS_SIDE = 8192
export const EXPORT_PADDING = 40

export function recordsForScope(scene: Scene, selection: RecordId[], scope: ExportScope): SceneRecord[] {
  if (scope === 'selection' && selection.length > 0) {
    const records: SceneRecord[] = []
    for (const id of selection) {
      const record = scene.get(id)
      if (record) records.push(record)
    }
    return records
  }
  return scene.ordered()
}

/** 计算导出范围：内容包围盒 + 内边距，空场景给出一块默认画布 */
export function resolveBounds(records: SceneRecord[], padding = EXPORT_PADDING): Rect {
  if (records.length === 0) return { x: 0, y: 0, w: 960, h: 600 }
  const bounds = unionRects(records.map((record) => recordBounds(record)))
  if (!bounds) return { x: 0, y: 0, w: 960, h: 600 }
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    w: Math.max(bounds.w + padding * 2, 64),
    h: Math.max(bounds.h + padding * 2, 64),
  }
}

/** 依据画布上限收敛导出倍率 */
export function clampScale(bounds: Rect, scale: number, maxSide = MAX_CANVAS_SIDE): number {
  const longest = Math.max(bounds.w, bounds.h, 1)
  const allowed = maxSide / longest
  return Math.max(0.1, Math.min(scale, allowed))
}

export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned.slice(0, 80) : '未命名白板'
}

export function timestampSuffix(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}
