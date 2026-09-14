import { useEffect, useState } from 'react'
import { Button } from '../primitives/Button'
import { Dialog } from '../primitives/Dialog'
import { useBoardStore } from '../../store/board-store'
import { useEngine } from '../canvas/engine-context'

export interface RenameDialogProps {
  open: boolean
  onClose: () => void
}

/** 重命名白板：输入即预览，回车确认 */
export function RenameDialog({ open, onClose }: RenameDialogProps) {
  const engine = useEngine()
  const boardName = useBoardStore((state) => state.boardName)
  const [value, setValue] = useState(boardName)

  useEffect(() => {
    if (open) setValue(boardName)
  }, [open, boardName])

  const confirm = () => {
    const next = value.trim()
    if (next.length > 0 && next !== boardName) {
      useBoardStore.getState().renameBoard(next)
      engine.markDirty()
      engine.showToast('已重命名', 'success')
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="重命名白板"
      description="名称会显示在白板库列表与窗口标题中"
      width="w-[440px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={confirm}>
            保存名称
          </Button>
        </>
      }
    >
      <input
        autoFocus
        value={value}
        maxLength={60}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') confirm()
        }}
        placeholder="例如：产品评审会白板"
        className="wb-focus h-11 w-full rounded-2xl border border-surface-border bg-surface-sunken px-3.5 text-[14px] font-medium text-content-primary outline-none transition-colors duration-150 focus:border-brand-400"
      />
    </Dialog>
  )
}
