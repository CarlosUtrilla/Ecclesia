import { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Copy, TextCursorInput, Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '@/ui/context-menu'

type Props = {
  children: ReactNode
  onLayerUp?: () => void
  onLayerDown?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onEditText?: () => void
}

export default function CanvasItemContextMenu({
  children,
  onLayerUp,
  onLayerDown,
  onDuplicate,
  onDelete,
  onEditText
}: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {onEditText ? (
          <>
            <ContextMenuItem onSelect={onEditText}>
              <TextCursorInput className="size-4" />
              Editar texto
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : null}

        <ContextMenuItem onSelect={onLayerUp}>
          <ArrowUp className="size-4" />
          Subir capa
        </ContextMenuItem>
        <ContextMenuItem onSelect={onLayerDown}>
          <ArrowDown className="size-4" />
          Bajar capa
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onDuplicate}>
          <Copy className="size-4" />
          Duplicar
          <ContextMenuShortcut>⌘/Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 className="size-4" />
          Eliminar
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
