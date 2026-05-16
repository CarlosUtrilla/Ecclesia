import { Copy, Edit3, Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { useState } from 'react'

type Props = {
  children: React.ReactNode
  onDuplicate: () => void
  onDelete: () => void
  onRename: () => void
  onSelect?: () => void
}

export default function SlideCardContextMenu({
  children,
  onSelect,
  onDuplicate,
  onDelete,
  onRename
}: Props) {
  const [available, setAvailable] = useState(false)
  const handleDuplicate = () => {
    onDuplicate()
  }

  const handleDelete = () => {
    onDelete()
  }

  const handleRename = () => {
    onRename()
  }

  return (
    <ContextMenu
      onOpenChange={(isOpen) => {
        if (isOpen) {
          onSelect?.()
          setTimeout(() => {
            setAvailable(true)
          }, 150)
        } else {
          setAvailable(false)
        }
      }}
    >
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={handleRename} disabled={!available}>
          <Edit3 className="mr-2 size-4" />
          Renombrar diapositiva
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleDuplicate} disabled={!available}>
          <Copy className="mr-2 size-4" />
          Duplicar diapositiva
          <ContextMenuShortcut>⌘/Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={handleDelete} disabled={!available}>
          <Trash2 className="mr-2 size-4" />
          Eliminar diapositiva
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
