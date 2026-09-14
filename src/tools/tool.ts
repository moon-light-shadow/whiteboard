import type { Camera } from '../kernel/camera'
import type { ChangeSet, Point, RecordId, SceneRecord } from '../kernel/types'
import type { Scene } from '../kernel/scene'
import type { History } from '../kernel/history'
import type { ToolId, ToolStyle } from '../store/tool-store'

export interface PointerSample {
  /** 浏览器分配的指针 id，用于多指手势配对 */
  pointerId: number
  screen: Point
  world: Point
  /** 0.1 ~ 1，鼠标恒为 0.5 */
  pressure: number
  pointerType: 'mouse' | 'pen' | 'touch' | string
  button: number
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  /** 合并后的高频采样点（世界坐标） */
  coalesced: Point[]
  /** 合并后的高频压力值 */
  coalescedPressure: number[]
  time: number
  isPrimary: boolean
}

export interface ToolContext {
  scene: Scene
  history: History
  getCamera(): Camera
  setCamera(camera: Camera): void
  getStyle(): ToolStyle
  getToolId(): ToolId
  setTool(tool: ToolId): void
  getSelection(): RecordId[]
  setSelection(ids: RecordId[], options?: { additive?: boolean; silent?: boolean }): void
  /** 提交场景变更：写入历史（可选合并）并触发重绘 */
  commit(change: ChangeSet, options?: { merge?: boolean }): void
  /** 直接提交外部构造的批量变更集（增删改混合，例如橡皮分割笔迹） */
  applyBatch(change: ChangeSet, options?: { merge?: boolean }): void
  requestRender(): void
  requestOverlay(): void
  toScreen(point: Point): Point
  toWorld(point: Point): Point
  isDark(): boolean
  showToast(message: string, tone?: 'info' | 'success' | 'error'): void
  startEditing(id: RecordId, options?: { selectAll?: boolean; caretToEnd?: boolean; isNew?: boolean }): void
  importImageAt(world: Point): Promise<void>
  hitTest(world: Point, tolerance?: number): SceneRecord | null
}

export interface Tool {
  id: ToolId
  cursor: string
  activate?(ctx: ToolContext): void
  deactivate?(ctx: ToolContext): void
  onPointerDown?(event: PointerSample, ctx: ToolContext): void
  onPointerMove?(event: PointerSample, ctx: ToolContext): void
  onPointerUp?(event: PointerSample, ctx: ToolContext): void
  onDoubleClick?(event: PointerSample, ctx: ToolContext): void
  /** 返回 true 表示已消费该按键 */
  onKeyDown?(event: KeyboardEvent, ctx: ToolContext): boolean
  /** 悬停光标（返回 null 表示使用工具默认光标） */
  cursorFor?(world: Point, ctx: ToolContext): string | null
  /** 交互层草稿（世界坐标） */
  drawDraft?(ctx2d: CanvasRenderingContext2D, camera: Camera, ctx: ToolContext): void
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}
