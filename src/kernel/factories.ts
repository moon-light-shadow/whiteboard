import { nanoid } from 'nanoid'
import { polylineBounds, rectFromPoints } from './geometry'
import type {
  ArrowProps,
  ImageProps,
  InkProps,
  InkRecord,
  InkStyle,
  ImageRecord,
  NoteProps,
  NoteRecord,
  Point,
  Rect,
  SceneRecord,
  ShapeKind,
  ShapeProps,
  ShapeRecord,
  TextProps,
  TextRecord,
  ArrowRecord,
  LineKind,
} from './types'

export function newId(prefix = 'r'): string {
  return `${prefix}_${nanoid(10)}`
}

export function now(): number {
  return Date.now()
}

/** 复制记录并递增版本号，供更新使用 */
export function bump<T extends SceneRecord>(record: T): T {
  return { ...record, version: record.version + 1, updatedAt: now() }
}

/** 便签底色候选 */
export const NOTE_COLORS = ['#FFE7A0', '#B7E4C7', '#BFDBFE', '#FBCFE8', '#DDD6FE', '#FED7AA', '#E2E8F0'] as const

/** 墨迹颜色候选 */
export const INK_COLORS = [
  '#111827',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#0EA5E9',
  '#6366F1',
  '#A855F7',
  '#EC4899',
] as const

function base<T extends SceneRecord['type']>(
  id: string,
  type: T,
  rect: Rect,
  props: SceneRecord['props'],
): Record<string, unknown> {
  return {
    id,
    type,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    rotation: 0,
    z: '',
    version: 1,
    updatedAt: now(),
    props: props as unknown as Record<string, unknown>,
  }
}

export function flattenPoints(points: Point[]): number[] {
  const flat = new Array<number>(points.length * 2)
  for (let i = 0; i < points.length; i += 1) {
    flat[i * 2] = points[i].x
    flat[i * 2 + 1] = points[i].y
  }
  return flat
}

/** 由世界坐标点序列创建笔迹记录（顶点转为记录局部坐标） */
export function createInk(
  flat: number[],
  pressures: number[],
  options: { color: string; size: number; style: InkStyle; opacity: number },
): InkRecord {
  const bounds = polylineBounds(flat)
  const local = new Array<number>(flat.length)
  for (let i = 0; i < flat.length; i += 2) {
    local[i] = flat[i] - bounds.x
    local[i + 1] = flat[i + 1] - bounds.y
  }
  const props: InkProps = {
    points: local,
    pressures: pressures.slice(),
    color: options.color,
    size: options.size,
    style: options.style,
    opacity: options.opacity,
  }
  return base(newId('ink'), 'ink', bounds, props) as unknown as InkRecord
}

export function createNote(rect: Rect, options?: Partial<NoteProps>): NoteRecord {
  const props: NoteProps = {
    text: '',
    color: options?.color ?? NOTE_COLORS[0],
    textColor: options?.textColor ?? '#3f2d0b',
    fontSize: options?.fontSize ?? 16,
  }
  return base(newId('note'), 'note', rect, props) as unknown as NoteRecord
}

export function createText(rect: Rect, options?: Partial<TextProps>): TextRecord {
  const props: TextProps = {
    text: '',
    color: options?.color ?? '#111827',
    fontSize: options?.fontSize ?? 20,
    bold: options?.bold ?? false,
    align: options?.align ?? 'left',
    lineHeight: options?.lineHeight ?? 1.35,
  }
  return base(newId('text'), 'text', rect, props) as unknown as TextRecord
}

export function createShape(kind: ShapeKind, rect: Rect, options?: Partial<ShapeProps>): ShapeRecord {
  const props: ShapeProps = {
    stroke: options?.stroke ?? '#1f2937',
    fill: options?.fill ?? 'transparent',
    size: options?.size ?? 2,
    dash: options?.dash ?? null,
  }
  return base(newId(kind), kind, rect, props) as unknown as ShapeRecord
}

export function createArrow(
  kind: LineKind,
  start: Point,
  end: Point,
  options?: Partial<ArrowProps> & { z?: string },
): ArrowRecord {
  const rect = rectFromPoints(start, end)
  const horizontal: 0 | 1 = end.x >= start.x ? 0 : 1
  const vertical: 0 | 1 = end.y >= start.y ? 0 : 1
  const props: ArrowProps = {
    n1x: horizontal,
    n1y: vertical,
    n2x: horizontal ? 0 : 1,
    n2y: vertical ? 0 : 1,
    double: options?.double ?? false,
    stroke: options?.stroke ?? '#1f2937',
    size: options?.size ?? 2,
    dash: options?.dash ?? null,
  }
  return base(newId(kind), kind, rect, props) as unknown as ArrowRecord
}

export function createImage(rect: Rect, options: Partial<ImageProps> & { assetId: string; mime: string }): ImageRecord {
  const props: ImageProps = {
    assetId: options.assetId,
    mime: options.mime,
    naturalWidth: options.naturalWidth ?? Math.round(rect.w),
    naturalHeight: options.naturalHeight ?? Math.round(rect.h),
    opacity: options.opacity ?? 1,
    radius: options.radius ?? 8,
  }
  return base(newId('img'), 'image', rect, props) as unknown as ImageRecord
}

/** 克隆一批记录（复制粘贴） */
export function cloneRecords(records: SceneRecord[], offset: number, generate: (prefix?: string) => string = newId): SceneRecord[] {
  return records.map((record) => {
    const copy = JSON.parse(JSON.stringify(record)) as SceneRecord
    copy.id = generate(record.type.slice(0, 3))
    copy.x += offset
    copy.y += offset
    copy.z = ''
    copy.version = 1
    copy.updatedAt = now()
    return copy
  })
}
