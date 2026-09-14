import { useCallback, useEffect, useRef, useState } from 'react'
import { FpsOverlay } from './dev/fps-overlay'
import { revokeAllObjectUrls, type BoardDocument } from './persist'
import { useShortcuts } from './shortcuts/use-shortcuts'
import { useBoardStore } from './store/board-store'
import { useUiStore } from './store/ui-store'
import { BoardLibrary } from './ui/boards/BoardLibrary'
import { BoardEngine } from './ui/canvas/board-engine'
import { ContextMenu } from './ui/canvas/ContextMenu'
import { EngineProvider } from './ui/canvas/engine-context'
import { TextEditorOverlay } from './ui/canvas/TextEditorOverlay'
import { ExportDialog } from './ui/dialogs/ExportDialog'
import { RenameDialog } from './ui/dialogs/RenameDialog'
import { ShortcutsDialog } from './ui/dialogs/ShortcutsDialog'
import { TemplatesDialog } from './ui/dialogs/TemplatesDialog'
import { ToastHost } from './ui/primitives/Toast'
import { LeftRail } from './ui/toolbar/LeftRail'
import { StyleBar } from './ui/toolbar/StyleBar'
import { TopBar } from './ui/toolbar/TopBar'
import { ZoomBar } from './ui/toolbar/ZoomBar'

const APP_TITLE = 'Whiteboard · 无限画布白板'

export default function App() {
  const [doc, setDoc] = useState<BoardDocument | null>(null)

  useEffect(() => {
    document.title = doc ? `${doc.name} · Whiteboard` : APP_TITLE
  }, [doc])

  return (
    <>
      {doc ? (
        <Workspace key={doc.id} document={doc} onExit={() => setDoc(null)} />
      ) : (
        <BoardLibrary onOpen={setDoc} />
      )}
      <ToastHost />
    </>
  )
}

interface WorkspaceProps {
  document: BoardDocument
  onExit: () => void
}

/** 画布工作台：装配引擎、工具条、弹窗与快捷键 */
function Workspace({ document: doc, onExit }: WorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<BoardEngine | null>(null)
  const [engine, setEngine] = useState<BoardEngine | null>(null)

  const dialog = useUiStore((state) => state.dialog)
  const closeDialog = useUiStore((state) => state.closeDialog)
  const closeContextMenu = useUiStore((state) => state.closeContextMenu)
  const fpsVisible = useUiStore((state) => state.fpsVisible)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    useBoardStore.getState().setBoard(doc.id, doc.name)
    const instance = new BoardEngine({
      container,
      boardId: doc.id,
      boardName: doc.name,
      createdAt: doc.createdAt,
      records: doc.records,
      camera: doc.camera,
    })
    engineRef.current = instance
    instance.fitOnFirstOpen()
    setEngine(instance)
    return () => {
      engineRef.current = null
      setEngine(null)
      instance.destroy()
      revokeAllObjectUrls()
      const ui = useUiStore.getState()
      ui.closeDialog()
      ui.closeContextMenu()
      useBoardStore.getState().setBoard(null, '未命名白板')
    }
  }, [doc])

  useShortcuts(engine)

  /** 离开前先落盘，避免列表缩略图与最后一批变更丢失 */
  const handleExit = useCallback(async () => {
    await engineRef.current?.saveNow()
    onExit()
  }, [onExit])

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-base">
      <div ref={containerRef} className="absolute inset-0 select-none touch-none" />
      {engine ? (
        <EngineProvider value={engine}>
          <TopBar onExit={() => void handleExit()} />
          <LeftRail />
          <StyleBar />
          <ZoomBar />
          <ContextMenu />
          <TextEditorOverlay />
          <ExportDialog open={dialog === 'export'} onClose={closeDialog} />
          <RenameDialog open={dialog === 'rename'} onClose={closeDialog} />
          <ShortcutsDialog open={dialog === 'shortcuts'} onClose={closeDialog} />
          <TemplatesDialog open={dialog === 'templates'} onClose={closeDialog} />
          {import.meta.env.DEV && fpsVisible ? <FpsOverlay /> : null}
        </EngineProvider>
      ) : null}
    </div>
  )
}
