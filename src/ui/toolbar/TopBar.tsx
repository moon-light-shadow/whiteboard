import { useState, type ReactNode } from 'react'
import {
  Activity,
  ChevronLeft,
  Cloud,
  Gauge,
  Keyboard,
  LayoutTemplate,
  Maximize,
  Moon,
  Redo2,
  Save,
  Sun,
  Undo2,
  Wand2,
} from 'lucide-react'
import { buildStressScene } from '../../dev/stress-scene'
import { useBoardStore } from '../../store/board-store'
import { useUiStore } from '../../store/ui-store'
import { cn } from '../primitives/cn'
import { Button, IconButton } from '../primitives/Button'
import { Popover, MenuItem } from '../primitives/Popover'
import { Tooltip } from '../primitives/Tooltip'
import { useCompactLayout } from '../primitives/use-media-query'
import { useEngine } from '../canvas/engine-context'
import { redo, undo } from '../canvas/engine-commands'

export interface TopBarProps {
  onExit: () => void
}

function formatTime(value: number | null): string {
  if (!value) return ''
  const date = new Date(value)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** 顶部工具条：返回、白板名、撤销重做、缩放、导出与主题；手机端收进「更多」菜单 */
export function TopBar({ onExit }: TopBarProps) {
  const engine = useEngine()
  const compact = useCompactLayout()
  const [moreOpen, setMoreOpen] = useState(false)
  const boardName = useBoardStore((state) => state.boardName)
  const history = useBoardStore((state) => state.history)
  const dirty = useBoardStore((state) => state.dirty)
  const saving = useBoardStore((state) => state.saving)
  const lastSavedAt = useBoardStore((state) => state.lastSavedAt)
  const cameraVersion = useBoardStore((state) => state.cameraVersion)
  const theme = useUiStore((state) => state.theme)
  const fpsVisible = useUiStore((state) => state.fpsVisible)
  const openDialog = useUiStore((state) => state.openDialog)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const toggleFps = useUiStore((state) => state.toggleFps)

  const status = saving ? '保存中…' : dirty ? '有未保存更改' : lastSavedAt ? `已保存 ${formatTime(lastSavedAt)}` : '已同步到本机'
  const zoom = engine.cameraState.z
  void cameraVersion

  const save = async () => {
    await engine.saveNow()
    engine.showToast('已保存到本机', 'success')
  }

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex items-start justify-between gap-3">
      <div className="wb-glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5">
        <Tooltip label="返回白板库" side="bottom">
          <Button variant="ghost" size="md" onClick={onExit} className="shrink-0 gap-1 pl-2 pr-3">
            <ChevronLeft size={16} />
            {compact ? null : '白板库'}
          </Button>
        </Tooltip>
        <div className="mx-0.5 h-6 w-px shrink-0 bg-surface-border" />
        <button
          type="button"
          onClick={() => openDialog('rename')}
          title="点击重命名"
          className={cn(
            'wb-focus min-w-0 truncate rounded-[10px] px-2.5 py-1.5 text-[13px] font-semibold text-content-primary transition-colors duration-150 hover:bg-surface-hover',
            compact ? 'max-w-[112px]' : 'max-w-[220px]',
          )}
        >
          {boardName}
        </button>
        {compact ? null : (
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium',
              dirty ? 'text-amber-600 dark:text-amber-400' : 'text-content-muted',
            )}
          >
            <Cloud size={12} />
            {status}
          </span>
        )}
      </div>

      <div className="wb-glass pointer-events-auto flex items-center gap-0.5 rounded-2xl p-1.5">
        <Tooltip label={history.canUndo ? `撤销 ${history.undoLabel || ''}` : '撤销'} shortcut="Ctrl+Z" side="bottom">
          <IconButton label="撤销" disabled={!history.canUndo} onClick={() => undo(engine)}>
            <Undo2 size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip label={history.canRedo ? `重做 ${history.redoLabel || ''}` : '重做'} shortcut="Ctrl+Shift+Z" side="bottom">
          <IconButton label="重做" disabled={!history.canRedo} onClick={() => redo(engine)}>
            <Redo2 size={16} />
          </IconButton>
        </Tooltip>
        <div className="mx-0.5 h-6 w-px bg-surface-border" />
        <Tooltip label="导出" shortcut="Ctrl+E" side="bottom">
          <IconButton label="导出" onClick={() => openDialog('export')}>
            <Wand2 size={16} />
          </IconButton>
        </Tooltip>
        {compact ? (
          <Popover
            open={moreOpen}
            onOpenChange={setMoreOpen}
            align="end"
            panelClassName="w-[210px]"
            trigger={
              <button
                type="button"
                aria-label="更多"
                aria-expanded={moreOpen}
                className={cn(
                  'wb-focus h-9 shrink-0 rounded-[11px] px-2.5 text-[12px] font-semibold transition-colors duration-150',
                  moreOpen ? 'bg-brand-500/14 text-brand-600 dark:text-brand-300' : 'text-content-secondary hover:bg-surface-hover',
                )}
              >
                更多
              </button>
            }
          >
            <div className="flex flex-col gap-0.5">
              <MenuItem
                onSelect={() => {
                  engine.zoomToPercent(100)
                  setMoreOpen(false)
                }}
              >
                回到 100%
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  engine.fitToContent()
                  setMoreOpen(false)
                }}
              >
                适配内容
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  openDialog('templates')
                  setMoreOpen(false)
                }}
              >
                模板库
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  void save()
                  setMoreOpen(false)
                }}
              >
                立即保存
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  toggleTheme()
                  setMoreOpen(false)
                }}
              >
                {theme === 'dark' ? '切换到浅色' : '切换到深色'}
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  openDialog('shortcuts')
                  setMoreOpen(false)
                }}
              >
                快捷键
              </MenuItem>
            </div>
          </Popover>
        ) : (
          <>
            <button
              type="button"
              onClick={() => engine.zoomToPercent(100)}
              title="回到 100%"
              className="wb-focus h-9 min-w-[54px] rounded-[11px] px-2 text-[12px] font-semibold tabular-nums text-content-primary transition-colors duration-150 hover:bg-surface-hover"
            >
              {Math.round(zoom * 100)}%
            </button>
            <div className="mx-0.5 h-6 w-px bg-surface-border" />
            <Tooltip label="模板库" side="bottom">
              <IconButton label="模板库" onClick={() => openDialog('templates')}>
                <LayoutTemplate size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip label="立即保存" shortcut="Ctrl+S" side="bottom">
              <IconButton label="立即保存" onClick={() => void save()}>
                <Save size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip label={theme === 'dark' ? '切换到浅色' : '切换到深色'} shortcut="Ctrl+Shift+D" side="bottom">
              <IconButton label="切换主题" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </IconButton>
            </Tooltip>
            {import.meta.env.DEV ? (
              <>
                <Tooltip label="压力测试场景（500 笔迹 + 50 便签）" side="bottom">
                  <IconButton
                    label="压力测试"
                    onClick={() => {
                      engine.loadRecords(buildStressScene(), 'stress')
                      engine.showToast('已生成压力测试场景', 'success')
                    }}
                  >
                    <Gauge size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip label="性能面板" shortcut="F" side="bottom">
                  <IconButton label="性能面板" active={fpsVisible} onClick={toggleFps}>
                    <Activity size={16} />
                  </IconButton>
                </Tooltip>
              </>
            ) : null}
            <Tooltip label="快捷键" shortcut="?" side="bottom">
              <IconButton label="快捷键" onClick={() => openDialog('shortcuts')}>
                <Keyboard size={16} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  )
}
