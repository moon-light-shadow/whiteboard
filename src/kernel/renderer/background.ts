import type { Camera } from '../camera'

export type BackgroundVariant = 'dots' | 'grid' | 'plain'

const LIGHT_BG = '#fdfdfe'
const DARK_BG = '#0b1220'

/** 画布底色：导出与缩略图需要与屏幕一致 */
export const BACKGROUND_COLORS = { light: LIGHT_BG, dark: DARK_BG } as const
const LIGHT_DOT = 'rgba(100, 116, 139, 0.32)'
const DARK_DOT = 'rgba(148, 163, 184, 0.24)'
const LIGHT_LINE = 'rgba(100, 116, 139, 0.14)'
const DARK_LINE = 'rgba(148, 163, 184, 0.1)'

function spacingFor(zoom: number): number {
  if (zoom < 0.3) return 256
  if (zoom < 0.55) return 128
  if (zoom < 0.95) return 64
  return 32
}

/** 背景层：按相机偏移程序化绘制点阵/网格，屏幕空间绘制保证清晰 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewport: { w: number; h: number },
  options: { variant: BackgroundVariant; isDark: boolean; dpr: number },
): void {
  const { variant, isDark, dpr } = options
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = isDark ? DARK_BG : LIGHT_BG
  ctx.fillRect(0, 0, viewport.w, viewport.h)
  if (variant === 'plain') return

  const spacing = spacingFor(camera.z)
  const worldLeft = camera.x
  const worldTop = camera.y
  const worldRight = camera.x + viewport.w / camera.z
  const worldBottom = camera.y + viewport.h / camera.z
  const startX = Math.floor(worldLeft / spacing) * spacing
  const startY = Math.floor(worldTop / spacing) * spacing

  if (variant === 'dots') {
    const size = camera.z > 1.6 ? 2.4 : camera.z > 0.95 ? 2 : 2.6
    ctx.fillStyle = isDark ? DARK_DOT : LIGHT_DOT
    for (let wx = startX; wx <= worldRight; wx += spacing) {
      const sx = (wx - camera.x) * camera.z
      for (let wy = startY; wy <= worldBottom; wy += spacing) {
        const sy = (wy - camera.y) * camera.z
        ctx.fillRect(sx, sy, size, size)
      }
    }
    return
  }

  ctx.lineWidth = 1
  ctx.strokeStyle = isDark ? DARK_LINE : LIGHT_LINE
  ctx.beginPath()
  for (let wx = startX; wx <= worldRight; wx += spacing) {
    const sx = Math.round((wx - camera.x) * camera.z) + 0.5
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, viewport.h)
  }
  for (let wy = startY; wy <= worldBottom; wy += spacing) {
    const sy = Math.round((wy - camera.y) * camera.z) + 0.5
    ctx.moveTo(0, sy)
    ctx.lineTo(viewport.w, sy)
  }
  ctx.stroke()
}
