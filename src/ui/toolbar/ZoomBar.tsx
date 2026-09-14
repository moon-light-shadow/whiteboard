import { Maximize, Minus, Plus } from 'lucide-react'
import { Tooltip } from '../primitives/Tooltip'
import { useBoardStore } from '../../store/board-store'
import { useEngine } from '../canvas/engine-context'

const STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]

/** 右下角缩放控件：百分比气泡 + 缩放/适配 */
export function ZoomBar() {
  const engine = useEngine()
  const cameraVersion = useBoardStore((state) => state.cameraVersion)
  const zoom = engine.cameraState.z

  const step = (direction: 1 | -1) => {
    if (direction > 0) {
      const next = STEPS.find((value) => value > zoom + 0.001)
      engine.zoomToPercent(Math.round((next ?? zoom * 1.5) * 100))
    } else {
      const next = [...STEPS].reverse().find((value) => value < zoom - 0.001)
      engine.zoomToPercent(Math.round((next ?? zoom / 1.5) * 100))
    }
  }

  return (
    <div className="wb-glass absolute bottom-5 right-5 z-30 flex items-center gap-0.5 rounded-2xl p-1">
      <Tooltip label="缩小" shortcut="Ctrl+-">
        <button
          type="button"
          aria-label="缩小"
          onClick={() => step(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-content-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-content-primary"
        >
          <Minus size={16} />
        </button>
      </Tooltip>
      <button
        type="button"
        onClick={() => engine.zoomToPercent(100)}
        className="h-8 min-w-[52px] rounded-xl px-2 text-[12px] font-semibold tabular-nums text-content-primary transition-colors duration-150 hover:bg-surface-hover"
        title="点击回到 100%"
        data-camera-version={cameraVersion}
      >
        {Math.round(zoom * 100)}%
      </button>
      <Tooltip label="放大" shortcut="Ctrl+=">
        <button
          type="button"
          aria-label="放大"
          onClick={() => step(1)}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-content-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-content-primary"
        >
          <Plus size={16} />
        </button>
      </Tooltip>
      <div className="mx-1 h-5 w-px bg-surface-border" />
      <Tooltip label="适配内容" shortcut="Shift+1">
        <button
          type="button"
          aria-label="适配内容"
          onClick={() => engine.fitToContent()}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-content-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-content-primary"
        >
          <Maximize size={16} />
        </button>
      </Tooltip>
    </div>
  )
}
