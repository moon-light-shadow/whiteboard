import { useEffect, useState } from 'react'
import { useBoardStore } from '../store/board-store'
import { useEngineOptional } from '../ui/canvas/engine-context'

interface Stats {
  fps: number
  records: number
  selection: number
  zoom: number
  size: { w: number; h: number }
}

/** 开发模式性能面板：FPS / 记录数 / 选区数 / 缩放 */
export function FpsOverlay() {
  const engine = useEngineOptional()
  const cameraVersion = useBoardStore((state) => state.cameraVersion)
  const selection = useBoardStore((state) => state.selection)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (!engine) return
    const timer = window.setInterval(() => {
      setStats({
        fps: engine.renderer.fps,
        records: engine.scene.ordered().length,
        selection: selection.length,
        zoom: engine.cameraState.z,
        size: engine.renderer.size,
      })
    }, 400)
    return () => window.clearInterval(timer)
  }, [engine, selection.length, cameraVersion])

  if (!engine || !stats) return null

  return (
    <div className="pointer-events-none absolute right-4 top-16 z-50 rounded-xl bg-slate-900/82 px-3 py-2 font-mono text-[10.5px] leading-relaxed text-emerald-300 shadow-pop backdrop-blur">
      <div>FPS {stats.fps.toFixed(0)}</div>
      <div>记录 {stats.records}</div>
      <div>选中 {stats.selection}</div>
      <div>缩放 {(stats.zoom * 100).toFixed(0)}%</div>
      <div>
        视口 {stats.size.w}×{stats.size.h}
      </div>
    </div>
  )
}
