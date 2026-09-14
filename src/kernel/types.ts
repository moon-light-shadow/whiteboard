/**
 * 白板记录模型。
 *
 * 设计要点：所有内容都是可序列化的 JSON 记录，带 `version` / `updatedAt`，
 * 为将来多端同步（增量合并、冲突处理）预留能力；图片等二进制资源外置为文件，
 * 记录中只保存引用。
 */

export type RecordId = string

export type ShapeKind = 'rect' | 'roundedRect' | 'ellipse' | 'triangle' | 'diamond'
export type LineKind = 'line' | 'arrow'
export type RecordType = 'ink' | 'note' | 'text' | ShapeKind | LineKind | 'image'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type InkStyle = 'pen' | 'highlighter'

export interface InkProps {
  /** 相对记录左上角的局部坐标点序列：[x0, y0, x1, y1, ...] */
  points: number[]
  /** 与 points 一一对应的压力值（0.15 ~ 1） */
  pressures: number[]
  color: string
  size: number
  style: InkStyle
  opacity: number
}

export interface NoteProps {
  text: string
  /** 便签底色 */
  color: string
  textColor: string
  fontSize: number
}

export interface TextProps {
  text: string
  color: string
  fontSize: number
  bold: boolean
  align: 'left' | 'center' | 'right'
  lineHeight: number
}

export interface ShapeProps {
  stroke: string
  fill: string
  size: number
  dash: number[] | null
}

export interface ArrowProps {
  /** 端点以包围盒归一化坐标 [0,1] 存储，便于随 w/h 缩放 */
  n1x: number
  n1y: number
  n2x: number
  n2y: number
  double: boolean
  stroke: string
  size: number
  dash: number[] | null
}

export interface ImageProps {
  assetId: string
  mime: string
  naturalWidth: number
  naturalHeight: number
  opacity: number
  radius: number
}

export type Props = InkProps | NoteProps | TextProps | ShapeProps | ArrowProps | ImageProps

interface BaseRecord {
  id: RecordId
  /** 世界坐标下的未旋转包围盒 */
  x: number
  y: number
  w: number
  h: number
  rotation: number
  /** 层级顺序（定宽数字字符串，可按字符串比较排序） */
  z: string
  /** 每次本地修改自增，供未来同步合并使用 */
  version: number
  updatedAt: number
}

export interface InkRecord extends BaseRecord {
  type: 'ink'
  props: InkProps
}

export interface NoteRecord extends BaseRecord {
  type: 'note'
  props: NoteProps
}

export interface TextRecord extends BaseRecord {
  type: 'text'
  props: TextProps
}

export interface ShapeRecord extends BaseRecord {
  type: ShapeKind
  props: ShapeProps
}

export interface ArrowRecord extends BaseRecord {
  type: LineKind
  props: ArrowProps
}

export interface ImageRecord extends BaseRecord {
  type: 'image'
  props: ImageProps
}

export type SceneRecord = InkRecord | NoteRecord | TextRecord | ShapeRecord | ArrowRecord | ImageRecord

/** 单条记录的补丁（更新时使用） */
export interface RecordPatch {
  x?: number
  y?: number
  w?: number
  h?: number
  rotation?: number
  z?: string
  props?: Record<string, unknown>
}

/** 事务化变更集：驱动历史栈、增量重绘与未来的同步消息 */
export interface ChangeSet {
  label: string
  added: SceneRecord[]
  updated: { before: SceneRecord; after: SceneRecord }[]
  removed: SceneRecord[]
  /** 撤销/重做时一并还原的选区 */
  selectionBefore?: RecordId[]
  selectionAfter?: RecordId[]
}

export interface SceneSnapshot {
  version: number
  records: SceneRecord[]
  camera?: { x: number; y: number; z: number }
  updatedAt: number
}

export interface BoardMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  recordCount: number
  /** data URL 缩略图（可选，列表页懒加载） */
  thumbnail?: string
  storage: 'local' | 'cloud'
}

export function isInk(r: SceneRecord): r is InkRecord {
  return r.type === 'ink'
}

export function isNote(r: SceneRecord): r is NoteRecord {
  return r.type === 'note'
}

export function isText(r: SceneRecord): r is TextRecord {
  return r.type === 'text'
}

export function isShape(r: SceneRecord): r is ShapeRecord {
  return r.type === 'rect' || r.type === 'roundedRect' || r.type === 'ellipse' || r.type === 'triangle' || r.type === 'diamond'
}

export function isArrow(r: SceneRecord): r is ArrowRecord {
  return r.type === 'line' || r.type === 'arrow'
}

export function isImage(r: SceneRecord): r is ImageRecord {
  return r.type === 'image'
}
