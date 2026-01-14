import { PresentationView } from '@/components/PresentationView'
import { useThemes } from '@/hooks/useThemes'
import { Button } from '@/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Edit, Plus, Trash2 } from 'lucide-react'

export default function ThemesPanel() {
  const { themes, refetchThemes } = useThemes()

  const handleEditarTema = (themeId: number) => {
    window.windowAPI.openThemeWindow(themeId)
  }

  const handleEliminarTema = (themeId: number) => {
    // preguntar confirmación
    const confirmed = window.confirm('¿Estás seguro de que deseas eliminar este tema?')
    if (!confirmed) return

    window.api.themes.deleteTheme(themeId).then(() => {
      refetchThemes()
    })
  }
  return (
    <div className="flex-1 border-t">
      <div className="bg-muted/40 px-3 py-1 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">Themes</h2>
        <div>
          <Button
            size="sm"
            className="text-xs h-7"
            onClick={() => window.windowAPI.openThemeWindow()}
          >
            <Plus /> Add Theme
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-wrap overflow-y-auto p-3 max-h-max">
        {themes.map((theme) => (
          <ContextMenu key={theme.id}>
            <ContextMenuTrigger className="rounded-md overflow-hidden">
              <PresentationView
                theme={theme}
                items={[
                  {
                    text: 'Preview Text'
                  }
                ]}
              />
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => handleEditarTema(theme.id)}>
                <Edit /> Editar tema
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleEliminarTema(theme.id)}>
                <Trash2 className="text-destructive" /> Borrar tema
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    </div>
  )
}
