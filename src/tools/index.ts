import type { ToolId } from '../store/tool-store'
import { EraserTool } from './eraser-tool'
import { HandTool } from './hand-tool'
import { ImageTool } from './image-tool'
import { LassoTool } from './lasso-tool'
import { NoteTool } from './note-tool'
import { createHighlighterTool, createPenTool } from './pen-tool'
import type { Tool } from './tool'
import { SelectTool } from './select-tool'
import { ShapeTool } from './shape-tool'
import { TextTool } from './text-tool'
import { ArrowTool } from './arrow-tool'

export function createToolRegistry(): Map<ToolId, Tool> {
  const tools: Tool[] = [
    new SelectTool(),
    new LassoTool(),
    createPenTool(),
    createHighlighterTool(),
    new EraserTool(),
    new NoteTool(),
    new TextTool(),
    new ShapeTool(),
    new ArrowTool(),
    new ImageTool(),
    new HandTool(),
  ]
  return new Map(tools.map((tool) => [tool.id, tool]))
}

export { EraserTool, HandTool, ImageTool, LassoTool, NoteTool, SelectTool, ShapeTool, TextTool, ArrowTool }
