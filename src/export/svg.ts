import { imageCache } from '../kernel/image-cache'
import { BACKGROUND_COLORS } from '../kernel/renderer/background'
import { arrowEndpoints } from '../kernel/renderer/draw-shapes'
import { freeformOutline } from '../kernel/renderer/draw-ink'
import { NOTE_PADDING, NOTE_RADIUS, noteTextArea } from '../kernel/renderer/draw-note'
import { layoutText } from '../kernel/text-layout'
import type { ArrowRecord, NoteRecord, Rect, SceneRecord, ShapeRecord, TextRecord } from '../kernel/types'

const FONT_FAMILY = 'Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif'

const num = (value: number): string => String(Math.round(value * 100) / 100)

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 与 Canvas 一致的「世界 -> 记录局部」变换：绕记录中心旋转后平移到记录左上角 */
function transformOf(record: SceneRecord): string {
  const cx = record.x + record.w / 2
  const cy = record.y + record.h / 2
  const deg = (record.rotation * 180) / Math.PI
  const rotation = record.rotation ? `rotate(${num(deg)} ${num(cx)} ${num(cy)}) ` : ''
  return `${rotation}translate(${num(record.x)} ${num(record.y)})`
}

function paint(props: { fill: string; stroke: string; size: number; dash: number[] | null }): string {
  const parts: string[] = []
  if (props.fill && props.fill !== 'transparent') parts.push(`fill="${props.fill}"`)
  else parts.push('fill="none"')
  if (props.size > 0) {
    parts.push(`stroke="${props.stroke}"`, `stroke-width="${num(props.size)}"`, 'stroke-linejoin="round"', 'stroke-linecap="round"')
    if (props.dash && props.dash.length > 0) {
      parts.push(`stroke-dasharray="${props.dash.map((value) => num(value * props.size)).join(' ')}"`)
    }
  }
  return parts.join(' ')
}

function shapeElement(record: ShapeRecord): string {
  const w = Math.max(record.w, 0.01)
  const h = Math.max(record.h, 0.01)
  const attrs = paint(record.props)
  switch (record.type) {
    case 'ellipse':
      return `<ellipse cx="${num(w / 2)}" cy="${num(h / 2)}" rx="${num(w / 2)}" ry="${num(h / 2)}" ${attrs} />`
    case 'triangle':
      return `<polygon points="${num(w / 2)},0 ${num(w)},${num(h)} 0,${num(h)}" ${attrs} />`
    case 'diamond':
      return `<polygon points="${num(w / 2)},0 ${num(w)},${num(h / 2)} ${num(w / 2)},${num(h)} 0,${num(h / 2)}" ${attrs} />`
    case 'roundedRect':
      return `<rect width="${num(w)}" height="${num(h)}" rx="${num(Math.min(w, h) * 0.18)}" ${attrs} />`
    default:
      return `<rect width="${num(w)}" height="${num(h)}" ${attrs} />`
  }
}

function arrowHeads(record: ArrowRecord): string {
  const props = record.props
  const { a, b } = arrowEndpoints(record)
  const headLength = Math.max(props.size * 3.4, props.size + 8)
  const headWidth = headLength * 0.5
  const head = (tip: { x: number; y: number }, from: { x: number; y: number }) => {
    const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const local: Array<[number, number]> = [
      [0, 0],
      [-headLength, headWidth / 2],
      [-headLength * 0.78, 0],
      [-headLength, -headWidth / 2],
    ]
    const points = local
      .map(([x, y]) => `${num(tip.x + x * cos - y * sin)},${num(tip.y + x * sin + y * cos)}`)
      .join(' ')
    return `<polygon points="${points}" fill="${props.stroke}" />`
  }
  const parts: string[] = []
  if (record.type === 'arrow') parts.push(head(b, a))
  if (props.double) parts.push(head(a, b))
  return parts.join('')
}

function arrowElement(record: ArrowRecord): string {
  const props = record.props
  const { a, b } = arrowEndpoints(record)
  const dash =
    props.dash && props.dash.length > 0
      ? ` stroke-dasharray="${props.dash.map((value) => num(value * props.size)).join(' ')}"`
      : ''
  const line =
    props.size > 0
      ? `<line x1="${num(a.x)}" y1="${num(a.y)}" x2="${num(b.x)}" y2="${num(b.y)}" stroke="${props.stroke}" stroke-width="${num(props.size)}" stroke-linecap="round"${dash} />`
      : ''
  return line + arrowHeads(record)
}

function inkElement(record: Extract<SceneRecord, { type: 'ink' }>): string {
  const props = record.props
  const outline = freeformOutline(props.points, props.pressures, { size: props.size, style: props.style })
  if (outline.length < 2) return ''
  const d = outline.map((point, index) => `${index === 0 ? 'M' : 'L'}${num(point[0])} ${num(point[1])}`).join(' ') + ' Z'
  const opacity = props.opacity !== undefined && props.opacity < 1 ? ` opacity="${num(props.opacity)}"` : ''
  return `<path d="${d}" fill="${props.color}"${opacity} />`
}

function textLines(
  lines: string[],
  options: { x: number; top: number; lineHeight: number; fontSize: number; anchor: 'start' | 'middle' | 'end' },
): string {
  return lines
    .map(
      (line, index) =>
        `<tspan x="${num(options.x)}" y="${num(options.top + index * options.lineHeight)}">${esc(line)}</tspan>`,
    )
    .join('')
}

function noteElement(record: NoteRecord, isDark: boolean): string {
  const props = record.props
  const w = Math.max(record.w, 0.01)
  const h = Math.max(record.h, 0.01)
  const { width, height, layout } = noteTextArea(record)
  const maxLines = Math.max(1, Math.floor(height / layout.lineHeight))
  const lines = layout.lines.slice(0, maxLines)
  if (layout.lines.length > maxLines && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`
  }
  const body = textLines(lines, {
    x: NOTE_PADDING,
    top: NOTE_PADDING,
    lineHeight: layout.lineHeight,
    fontSize: props.fontSize,
    anchor: 'start',
  })
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'
  return [
    `<rect width="${num(w)}" height="${num(h)}" rx="${NOTE_RADIUS}" fill="${props.color}" stroke="${border}" />`,
    `<clipPath id="note-${record.id}"><rect width="${num(w)}" height="${num(h)}" rx="${NOTE_RADIUS}" /></clipPath>`,
    `<text clip-path="url(#note-${record.id})" font-family="${FONT_FAMILY}" font-size="${num(props.fontSize)}" font-weight="500" fill="${props.textColor}" dominant-baseline="hanging">${body}</text>`,
    `<!-- width=${num(width)} -->`,
  ].join('')
}

function textElement(record: TextRecord): string {
  const props = record.props
  const layout = layoutText(props.text, {
    fontSize: props.fontSize,
    bold: props.bold,
    maxWidth: Math.max(8, record.w),
    lineHeight: props.lineHeight,
  })
  const anchor = props.align === 'center' ? 'middle' : props.align === 'right' ? 'end' : 'start'
  const x = props.align === 'center' ? record.w / 2 : props.align === 'right' ? record.w : 0
  const body = textLines(layout.lines, {
    x,
    top: 0,
    lineHeight: layout.lineHeight,
    fontSize: props.fontSize,
    anchor,
  })
  return `<text font-family="${FONT_FAMILY}" font-size="${num(props.fontSize)}" font-weight="${props.bold ? 600 : 400}" fill="${props.color}" text-anchor="${anchor}" dominant-baseline="hanging">${body}</text>`
}

async function dataUrlForAsset(assetId: string): Promise<string | null> {
  await imageCache.ensure(assetId)
  const image = imageCache.get(assetId)
  if (!image || !image.naturalWidth) return null
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}

async function recordElement(record: SceneRecord, isDark: boolean): Promise<string> {
  const transform = transformOf(record)
  let inner = ''
  switch (record.type) {
    case 'ink':
      inner = inkElement(record)
      break
    case 'note':
      inner = noteElement(record, isDark)
      break
    case 'text':
      inner = textElement(record)
      break
    case 'image': {
      const href = await dataUrlForAsset(record.props.assetId)
      if (!href) return ''
      const opacity = record.props.opacity !== undefined && record.props.opacity < 1 ? ` opacity="${num(record.props.opacity)}"` : ''
      inner = `<image href="${href}" width="${num(record.w)}" height="${num(record.h)}" preserveAspectRatio="none" clip-path="url(#img-${record.id})"${opacity} /><defs><clipPath id="img-${record.id}"><rect width="${num(record.w)}" height="${num(record.h)}" rx="${num(record.props.radius)}" /></clipPath></defs>`
      break
    }
    case 'line':
    case 'arrow':
      inner = arrowElement(record)
      break
    default:
      inner = shapeElement(record)
      break
  }
  if (!inner) return ''
  return `<g transform="${transform}">${inner}</g>`
}

export interface SvgOptions {
  transparent?: boolean
  isDark?: boolean
}

/** 序列化为 SVG 文本（矢量导出，文本保持可选中） */
export async function buildSvg(records: SceneRecord[], bounds: Rect, options: SvgOptions = {}): Promise<string> {
  const isDark = Boolean(options.isDark)
  const parts: string[] = []
  for (const record of records) {
    const element = await recordElement(record, isDark)
    if (element) parts.push(element)
  }
  const background = options.transparent
    ? ''
    : `<rect width="100%" height="100%" fill="${isDark ? BACKGROUND_COLORS.dark : BACKGROUND_COLORS.light}" />`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(bounds.w)}" height="${num(bounds.h)}" viewBox="0 0 ${num(bounds.w)} ${num(bounds.h)}">`,
    background,
    `<g transform="translate(${num(-bounds.x)} ${num(-bounds.y)})">`,
    parts.join(''),
    '</g>',
    '</svg>',
  ].join('')
}

export function svgToBytes(svg: string): Uint8Array {
  return new TextEncoder().encode(svg)
}
