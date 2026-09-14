import { canvasToBlob } from './raster'

/** 把画布内容复制为 PNG 到系统剪贴板；不支持时返回 false */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false
  const blob = await canvasToBlob(canvas, 'image/png')
  const item = new ClipboardItem({ 'image/png': blob })
  await navigator.clipboard.write([item])
  return true
}

/** 复制纯文本（场景 JSON 等） */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false
  await navigator.clipboard.writeText(text)
  return true
}
