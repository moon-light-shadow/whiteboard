import { createImage, newId } from '../kernel/factories'
import { imageCache } from '../kernel/image-cache'
import type { ImageRecord, Point } from '../kernel/types'
import type { BoardRepository, PickedImage } from './repository'

/** 插入图片时的最大边长（世界单位），超大图自动等比缩小 */
const MAX_SIDE = 520
/** 多张图片同时插入时的错位偏移 */
const OFFSET = 32

export async function decodeImageSize(bytes: Uint8Array, mime: string): Promise<{ width: number; height: number }> {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime })
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  }
  const url = URL.createObjectURL(blob)
  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => resolve({ width: MAX_SIDE, height: MAX_SIDE })
    image.src = url
  })
  URL.revokeObjectURL(url)
  return size
}

function fitRect(size: { width: number; height: number }, center: Point): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(1, MAX_SIDE / Math.max(size.width || 1, size.height || 1))
  const w = Math.max(24, Math.round(size.width * scale))
  const h = Math.max(24, Math.round(size.height * scale))
  return { x: center.x - w / 2, y: center.y - h / 2, w, h }
}

/** 把图片写入资源目录并注册到渲染缓存，返回可直接加入场景的记录 */
export async function insertPickedImage(
  repo: BoardRepository,
  boardId: string,
  picked: PickedImage,
  center: Point,
  index = 0,
): Promise<ImageRecord | null> {
  if (picked.bytes.byteLength === 0) return null
  const size = await decodeImageSize(picked.bytes, picked.mime)
  const assetId = newId('asset')
  await repo.writeAsset(boardId, assetId, picked.bytes, picked.mime)

  const offset = index * OFFSET
  const rect = fitRect(size, { x: center.x + offset, y: center.y + offset })
  const record = createImage(rect, {
    assetId,
    mime: picked.mime,
    naturalWidth: size.width,
    naturalHeight: size.height,
  })

  // 立即注册图片对象，避免首帧出现占位块
  const asset = await repo.readAsset(boardId, assetId)
  if (asset) {
    const url = URL.createObjectURL(new Blob([asset.bytes.slice().buffer as ArrayBuffer], { type: asset.mime }))
    const image = await loadImage(url)
    if (image) imageCache.put(assetId, image, url)
    else URL.revokeObjectURL(url)
  }
  return record
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

/** 从剪贴板事件或拖拽事件中提取图片文件 */
export function imagesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return []
  const files: File[] = []
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file && file.type.startsWith('image/')) files.push(file)
  }
  if (files.length === 0) {
    for (const file of Array.from(data.files ?? [])) {
      if (file.type.startsWith('image/')) files.push(file)
    }
  }
  return files
}

export async function pickedFromFiles(files: File[]): Promise<PickedImage[]> {
  const result: PickedImage[] = []
  for (const file of files) {
    result.push({
      name: file.name || 'image.png',
      mime: file.type || 'image/png',
      bytes: new Uint8Array(await file.arrayBuffer()),
    })
  }
  return result
}
