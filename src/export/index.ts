import type { Scene } from '../kernel/scene'
import type { RecordId } from '../kernel/types'
import { clampScale, recordsForScope, resolveBounds, type ExportScope } from './bounds'
import { buildPdf } from './pdf'
import { renderPng, renderPreview } from './png'
import { buildSvg, svgToBytes } from './svg'

export * from './bounds'
export * from './clipboard'
export * from './raster'

export type ExportFormat = 'png' | 'svg' | 'pdf'

export interface ExportRequest {
  format: ExportFormat
  scope: ExportScope
  scale: number
  transparent: boolean
  isDark: boolean
}

export interface ExportPayload {
  bytes: Uint8Array
  mime: string
  extension: string
}

const MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
}

/** 按请求生成导出字节流；PDF 走「位图嵌入单页」路径 */
export async function buildExport(
  scene: Scene,
  selection: RecordId[],
  request: ExportRequest,
): Promise<ExportPayload> {
  const records = recordsForScope(scene, selection, request.scope)
  const bounds = resolveBounds(records)
  const rasterOptions = { transparent: request.transparent, isDark: request.isDark }
  let bytes: Uint8Array

  if (request.format === 'svg') {
    bytes = svgToBytes(await buildSvg(records, bounds, rasterOptions))
  } else if (request.format === 'pdf') {
    const scale = clampScale(bounds, request.scale)
    const raster = await renderPng(records, bounds, scale, { ...rasterOptions, transparent: false })
    bytes = await buildPdf(raster.bytes, raster.width, raster.height)
  } else {
    const raster = await renderPng(records, bounds, request.scale, rasterOptions)
    bytes = raster.bytes
  }

  return { bytes, mime: MIME[request.format], extension: request.format }
}

/** 导出面板的预览图（统一 PNG，保持透明设置） */
export function buildPreview(
  scene: Scene,
  selection: RecordId[],
  options: { scope: ExportScope; isDark: boolean },
): { dataUrl: string; width: number; height: number; count: number } {
  const records = recordsForScope(scene, selection, options.scope)
  const bounds = resolveBounds(records)
  return {
    dataUrl: renderPreview(records, bounds, options.isDark),
    width: Math.round(bounds.w),
    height: Math.round(bounds.h),
    count: records.length,
  }
}
