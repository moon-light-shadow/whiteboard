import { createInk, createNote, NOTE_COLORS } from '../kernel/factories'
import type { SceneRecord } from '../kernel/types'

/** 伪随机数：压力场景需要可复现，避免每次生成结果不同 */
function createRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

export interface StressSceneOptions {
  strokes?: number
  notes?: number
  seed?: number
}

/**
 * 压力测试场景：默认 500 条笔迹 + 50 个便签，用于验收「500 条笔迹与 50 个便签场景下保持流畅」。
 * 仅在开发模式由界面按钮触发。
 */
export function buildStressScene(options: StressSceneOptions = {}): SceneRecord[] {
  const strokes = options.strokes ?? 500
  const notes = options.notes ?? 50
  const random = createRandom(options.seed ?? 20260913)
  const records: SceneRecord[] = []
  const columns = 25
  const cellW = 260
  const cellH = 150

  for (let index = 0; index < strokes; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const originX = column * cellW + 20
    const originY = row * cellH + 20
    const flat: number[] = []
    const pressures: number[] = []
    const points = 12 + Math.floor(random() * 10)
    const amplitude = 26 + random() * 34
    for (let point = 0; point < points; point += 1) {
      const t = point / (points - 1)
      flat.push(originX + t * (cellW - 70), originY + amplitude * Math.sin(t * Math.PI * 2 + random()))
      pressures.push(0.25 + Math.abs(Math.sin(t * Math.PI)) * 0.7)
    }
    records.push(
      createInk(flat, pressures, {
        color: `hsl(${Math.floor(random() * 360)} 72% 46%)`,
        size: 1.5 + random() * 5,
        opacity: 1,
        style: 'pen',
      }),
    )
  }

  for (let index = 0; index < notes; index += 1) {
    const column = index % 10
    const row = Math.floor(index / 10)
    const record = createNote(
      { x: column * 300 - 120, y: row * 220 + 190, w: 240, h: 150 },
      { color: NOTE_COLORS[index % NOTE_COLORS.length], fontSize: 15, textColor: '#3f2d0b' },
    )
    record.props.text = `压力场景便签 ${index + 1}\n\n用于验证大量对象下的渲染与命中性能。`
    records.push(record)
  }

  return records
}
