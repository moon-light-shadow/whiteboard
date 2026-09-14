import type { Rect, SceneRecord } from '../kernel/types'
import { clampScale } from './bounds'
import { canvasToBytes, canvasToDataUrl, renderRecordsToCanvas, type RasterOptions } from './raster'

/** 渲染位图导出结果（1x/2x/4x 由 scale 控制） */
export async function renderPng(
  records: SceneRecord[],
  bounds: Rect,
  scale: number,
  options: RasterOptions = {},
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const safeScale = clampScale(bounds, scale)
  const result = renderRecordsToCanvas(records, bounds, safeScale, options)
  const bytes = await canvasToBytes(result.canvas, 'image/png')
  return { bytes, width: result.width, height: result.height }
}

/** 列表页缩略图：限制最大边长，纯色底，避免过大占用存储 */
export function renderThumbnail(records: SceneRecord[], bounds: Rect, isDark: boolean, maxSide = 420): string {
  const scale = clampScale(bounds, maxSide / Math.max(bounds.w, bounds.h, 1))
  const result = renderRecordsToCanvas(records, bounds, scale, { isDark, variant: 'plain', transparent: false })
  return canvasToDataUrl(result.canvas)
}

/** 导出面板中的实时预览 */
export function renderPreview(records: SceneRecord[], bounds: Rect, isDark: boolean, maxSide = 220): string {
  const scale = clampScale(bounds, maxSide / Math.max(bounds.w, bounds.h, 1))
  const result = renderRecordsToCanvas(records, bounds, scale, { isDark, variant: 'plain', transparent: false })
  return canvasToDataUrl(result.canvas)
}
