import type { Camera } from '../camera'
import type { SceneRecord } from '../types'
import { drawImage } from './draw-image'
import { drawInk } from './draw-ink'
import { drawNote } from './draw-note'
import { drawArrow, drawShape } from './draw-shapes'
import { drawText } from './draw-text'

/**
 * 单条记录的绘制分派：渲染器与导出模块共用同一套绘制实现，
 * 保证「屏幕上看到的」与「导出的」完全一致。
 */
export function drawRecord(
  ctx: CanvasRenderingContext2D,
  record: SceneRecord,
  camera: Camera,
  isDark: boolean,
): void {
  switch (record.type) {
    case 'ink':
      drawInk(ctx, record, camera)
      break
    case 'note':
      drawNote(ctx, record, isDark)
      break
    case 'text':
      drawText(ctx, record)
      break
    case 'image':
      drawImage(ctx, record)
      break
    case 'line':
    case 'arrow':
      drawArrow(ctx, record, camera)
      break
    default:
      drawShape(ctx, record)
      break
  }
}
