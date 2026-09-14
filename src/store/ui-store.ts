import { create } from 'zustand'
import type { Point, RecordId } from '../kernel/types'

export type ThemeMode = 'light' | 'dark'

/** 全局唯一弹窗（同时只允许一个） */
export type DialogKind = 'export' | 'shortcuts' | 'rename' | 'templates'

export interface ContextMenuState {
  x: number
  y: number
  world: Point
  targetId: RecordId | null
}

const THEME_KEY = 'wb.theme'

export interface UiState {
  theme: ThemeMode
  fpsVisible: boolean
  dialog: DialogKind | null
  contextMenu: ContextMenuState | null
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  toggleFps: () => void
  openDialog: (dialog: DialogKind) => void
  closeDialog: () => void
  openContextMenu: (menu: ContextMenuState) => void
  closeContextMenu: () => void
  /** 通用提示（导出成功等） */
  toast: { id: number; message: string; tone: 'info' | 'success' | 'error' } | null
  showToast: (message: string, tone?: 'info' | 'success' | 'error') => void
  clearToast: () => void
}

export function getInitialTheme(): ThemeMode {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null
  if (stored === 'light' || stored === 'dark') return stored
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export function applyThemeClass(theme: ThemeMode): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
}

let toastTimer: number | null = null

export const useUiStore = create<UiState>((set, get) => ({
  theme: getInitialTheme(),
  fpsVisible: false,
  dialog: null,
  contextMenu: null,
  setTheme: (theme) => {
    applyThemeClass(theme)
    localStorage.setItem(THEME_KEY, theme)
    set({ theme })
  },
  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
  toggleFps: () => set({ fpsVisible: !get().fpsVisible }),
  openDialog: (dialog) => set({ dialog, contextMenu: null }),
  closeDialog: () => set({ dialog: null }),
  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => {
    if (get().contextMenu) set({ contextMenu: null })
  },
  toast: null,
  showToast: (message, tone = 'info') => {
    set({ toast: { id: Date.now(), message, tone } })
    if (toastTimer) window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => set({ toast: null }), 2600)
  },
  clearToast: () => set({ toast: null }),
}))
