/** PDF 导出：懒加载 pdf-lib，把渲染好的位图铺满单页 */
const MAX_PAGE_SIDE = 14400

export async function buildPdf(
  pngBytes: Uint8Array,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle('白板导出')
  doc.setProducer('Whiteboard Desktop')
  doc.setCreator('Whiteboard Desktop')

  const longest = Math.max(width, height, 1)
  const factor = longest > MAX_PAGE_SIDE ? MAX_PAGE_SIDE / longest : 1
  const pageWidth = Math.max(1, Math.round(width * factor))
  const pageHeight = Math.max(1, Math.round(height * factor))

  const image = await doc.embedPng(pngBytes)
  const page = doc.addPage([pageWidth, pageHeight])
  page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight })
  return doc.save()
}
