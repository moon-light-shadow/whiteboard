import type { Camera } from '../kernel/camera'
import { BACKGROUND_COLORS, type BackgroundVariant } from '../kernel/renderer/background'
import { worldTransform } from '../kernel/renderer/draw-common'
import { drawBackground } from '../kernel/renderer/background'
import { drawRecord } from '../kernel/renderer/draw-record'
import type { Rect, SceneRecord } from '../kernel/types'

export interface RasterOptions {
  transparent?: boolean
  isDark?: boolean
  /** 是否绘制点阵背景（缩略图/导出默认纯色底） */
  variant?: BackgroundVariant
}

export interface RasterResult {
  canvas: HTMLCanvasElement
  camera: Camera
  width: number
  height: number
}

/** 把一组记录以世界坐标渲染到离屏画布：导出、缩略图、剪贴板共用 */
export function renderRecordsToCanvas(
  records: SceneRecord[],
  bounds: Rect,
  scale: number,
  options: RasterOptions = {},
): RasterResult {
  const width = Math.max(1, Math.round(bounds.w * scale))
  const height = Math.max(1, Math.round(bounds.h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const isDark = Boolean(options.isDark)

  if (options.transparent) {
    ctx.clearRect(0, 0, width, height)
  } else if (options.variant && options.variant !== 'plain') {
    drawBackground(ctx, { x: bounds.x, y: bounds.y, z: scale }, { w: width, h: height }, {
      variant: options.variant,
      isDark,
      dpr: 1,
    })
  } else {
    ctx.fillStyle = isDark ? BACKGROUND_COLORS.dark : BACKGROUND_COLORS.light
    ctx.fillRect(0, 0, width, height)
  }

  const camera: Camera = { x: bounds.x, y: bounds.y, z: scale }
  worldTransform(ctx, camera, 1)
  for (const record of records) drawRecord(ctx, record, camera, isDark)
  return { canvas, camera, width, height }
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('画布导出失败'))
      },
      mime,
      1,
    )
  })
}

export async function canvasToBytes(canvas: HTMLCanvasElement, mime = 'image/png'): Promise<Uint8Array> {
  const blob = await canvasToBlob(canvas, mime)
  return new Uint8Array(await blob.arrayBuffer())
}

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}
