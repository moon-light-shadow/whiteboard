import { imageCache } from '../image-cache'
import type { ImageRecord } from '../types'
import { roundRectPath, withRecordTransform } from './draw-common'

const PLACEHOLDER = 'rgba(148, 163, 184, 0.18)'

/** 绘制图片记录；未加载完成时先绘制占位块，加载完成后由 imageCache 通知重绘 */
export function drawImage(ctx: CanvasRenderingContext2D, record: ImageRecord): void {
  const props = record.props
  const image = imageCache.get(props.assetId)
  withRecordTransform(ctx, record, () => {
    const w = Math.max(record.w, 0.01)
    const h = Math.max(record.h, 0.01)
    const path = new Path2D()
    roundRectPath(path, 0, 0, w, h, props.radius)
    ctx.save()
    ctx.clip(path)
    if (image && image.naturalWidth > 0) {
      ctx.globalAlpha = props.opacity ?? 1
      ctx.drawImage(image, 0, 0, w, h)
    } else {
      ctx.fillStyle = PLACEHOLDER
      ctx.fillRect(0, 0, w, h)
    }
    ctx.restore()
  })
}
