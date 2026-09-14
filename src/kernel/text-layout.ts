/**
 * 文本排版与度量缓存。
 * 便签/文字的换行结果按 (文本, 字号, 粗体, 最大宽度) 缓存，避免每帧重复度量。
 */

export interface TextLayout {
  lines: string[]
  width: number
  lineHeight: number
  height: number
}

let measureContext: CanvasRenderingContext2D | null = null

function getContext(): CanvasRenderingContext2D | null {
  if (measureContext) return measureContext
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  measureContext = canvas.getContext('2d')
  return measureContext
}

export function fontString(fontSize: number, bold = false): string {
  return `${bold ? '600 ' : ''}${fontSize}px Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
}

const CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/

export function measureLine(text: string, fontSize: number, bold = false): number {
  const ctx = getContext()
  if (!ctx) return text.length * fontSize * 0.6
  ctx.font = fontString(fontSize, bold)
  return ctx.measureText(text).width
}

/** 把一段文本按最大宽度折行（中英文混排，逐段贪心） */
export function wrapText(text: string, maxWidth: number, fontSize: number, bold = false): string[] {
  const lines: string[] = []
  const paragraphs = text.split('\n')
  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('')
      continue
    }
    if (maxWidth <= 0) {
      lines.push(paragraph)
      continue
    }
    let current = ''
    const tokens = tokenize(paragraph)
    for (const token of tokens) {
      const candidate = current + token
      if (current && measureLine(candidate, fontSize, bold) > maxWidth) {
        lines.push(current)
        current = token.trimStart()
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
  }
  if (lines.length === 0) lines.push('')
  return lines
}

function tokenize(paragraph: string): string[] {
  const tokens: string[] = []
  let buffer = ''
  for (const char of paragraph) {
    if (CJK.test(char)) {
      if (buffer) {
        tokens.push(buffer)
        buffer = ''
      }
      tokens.push(char)
    } else if (char === ' ') {
      if (buffer) {
        tokens.push(buffer)
        buffer = ''
      }
      tokens.push(' ')
    } else {
      buffer += char
    }
  }
  if (buffer) tokens.push(buffer)
  return tokens
}

const cache = new Map<string, TextLayout>()

function cacheKey(text: string, fontSize: number, bold: boolean, maxWidth: number, lineHeight: number): string {
  return `${fontSize}|${bold ? 1 : 0}|${Math.round(maxWidth)}|${lineHeight}|${text}`
}

export function layoutText(
  text: string,
  options: { fontSize: number; bold?: boolean; maxWidth: number; lineHeight?: number },
): TextLayout {
  const { fontSize, bold = false, maxWidth } = options
  const lh = options.lineHeight ?? 1.35
  const key = cacheKey(text, fontSize, bold, maxWidth, lh)
  const hit = cache.get(key)
  if (hit) return hit

  const lines = wrapText(text, maxWidth, fontSize, bold)
  let width = 0
  for (const line of lines) width = Math.max(width, measureLine(line, fontSize, bold))
  const lineHeight = Math.round(fontSize * lh)
  const layout: TextLayout = {
    lines,
    width: Math.min(width, maxWidth),
    lineHeight,
    height: lines.length * lineHeight,
  }
  if (cache.size > 600) cache.clear()
  cache.set(key, layout)
  return layout
}

/** 单行文本所需的宽度（用于文字工具自动撑开记录尺寸） */
export function intrinsicTextSize(text: string, fontSize: number, bold = false): { w: number; h: number } {
  const lines = text.split('\n')
  let width = 0
  for (const line of lines) width = Math.max(width, measureLine(line, fontSize, bold))
  return { w: Math.ceil(width), h: Math.max(1, lines.length) * Math.round(fontSize * 1.35) }
}

export function clearTextCache(): void {
  cache.clear()
}
