import type { Rect } from '../kernel/types'

export interface GuideLines {
  /** 竖直参考线的世界 x 坐标 */
  xs: number[]
  /** 水平参考线的世界 y 坐标 */
  ys: number[]
}

export interface SnapResult {
  dx: number
  dy: number
  guides: GuideLines
}

const EMPTY: SnapResult = { dx: 0, dy: 0, guides: { xs: [], ys: [] } }

function edgesX(rect: Rect): number[] {
  return [rect.x, rect.x + rect.w / 2, rect.x + rect.w]
}

function edgesY(rect: Rect): number[] {
  return [rect.y, rect.y + rect.h / 2, rect.y + rect.h]
}

/** 移动时对齐吸附：把移动框的边/中线吸附到其它对象的边/中线上 */
export function computeSnap(moving: Rect, targets: Rect[], tolerance: number): SnapResult {
  if (targets.length === 0 || tolerance <= 0) return EMPTY
  const movingX = edgesX(moving)
  const movingY = edgesY(moving)

  let bestX: { delta: number; line: number } | null = null
  let bestY: { delta: number; line: number } | null = null

  for (const target of targets) {
    for (const tx of edgesX(target)) {
      for (const mx of movingX) {
        const delta = tx - mx
        if (Math.abs(delta) <= tolerance && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
          bestX = { delta, line: tx }
        }
      }
    }
    for (const ty of edgesY(target)) {
      for (const my of movingY) {
        const delta = ty - my
        if (Math.abs(delta) <= tolerance && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
          bestY = { delta, line: ty }
        }
      }
    }
  }

  return {
    dx: bestX ? bestX.delta : 0,
    dy: bestY ? bestY.delta : 0,
    guides: {
      xs: bestX ? [bestX.line] : [],
      ys: bestY ? [bestY.line] : [],
    },
  }
}
