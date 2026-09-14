/**
 * 层级顺序：使用定宽数字字符串作为分数索引，字符串比较即层级顺序。
 * 每次插入取最大 z + Z_STEP；间距不足时由 Scene 触发重排。
 */
export const Z_STEP = 1024
export const Z_WIDTH = 7
const Z_MAX = 10 ** Z_WIDTH - 1

export function encodeZ(value: number): string {
  const n = Math.max(0, Math.min(Z_MAX, Math.round(value)))
  return n.toString().padStart(Z_WIDTH, '0')
}

export function decodeZ(z: string | undefined): number {
  if (!z) return 0
  const n = Number.parseInt(z, 10)
  return Number.isFinite(n) ? n : 0
}

/** 在新的最大 z 之后插入 */
export function zAfterTop(topZ: string | undefined, step = Z_STEP): string {
  return encodeZ(decodeZ(topZ) + step)
}

/** 取两个 z 之间的中间值，返回 null 表示间距不足需要重排 */
export function zBetween(a: string | undefined, b: string | undefined): string | null {
  const left = decodeZ(a)
  const right = b === undefined ? left + Z_STEP * 2 : decodeZ(b)
  const gap = right - left
  if (gap < 2) return null
  return encodeZ(left + Math.floor(gap / 2))
}

/** 按数组顺序重新分配均匀的 z 值 */
export function redistribute(count: number): string[] {
  const result: string[] = new Array(count)
  for (let i = 0; i < count; i += 1) result[i] = encodeZ((i + 1) * Z_STEP)
  return result
}
