import { createContext, useContext } from 'react'
import type { BoardEngine } from './board-engine'

const EngineContext = createContext<BoardEngine | null>(null)

export const EngineProvider = EngineContext.Provider

/** 取当前画布引擎；仅在画布工作台内部可用 */
export function useEngine(): BoardEngine {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('useEngine 必须在 EngineProvider 内使用')
  return engine
}

export function useEngineOptional(): BoardEngine | null {
  return useContext(EngineContext)
}
