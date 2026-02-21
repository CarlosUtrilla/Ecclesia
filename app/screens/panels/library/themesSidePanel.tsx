import { PresentationView } from '@/ui/PresentationView'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useThemes } from '@/hooks/useThemes'
import { Button } from '@/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Edit, Plus, Trash2 } from 'lucide-react'

// Nuevo diseño: panel lateral compacto, no compite visualmente
import { useState } from 'react'
import { Input } from '@/ui/input'

export function ThemesSidePanel() {
  const { themes, refetchThemes } = useThemes()
  const { selectedTheme, setSelectedTheme } = useSchedule()
  const [search, setSearch] = useState('')

  const handleEditarTema = (themeId: number) => {
    window.windowAPI.openThemeWindow(themeId)
  }

  const handleEliminarTema = (themeId: number) => {
    const confirmed = window.confirm('¿Estás seguro de que deseas eliminar este tema?')
    if (!confirmed) return
    window.api.themes.deleteTheme(themeId).then(() => {
      refetchThemes()
    })
  }

  // Filtrar temas por nombre
  const filteredThemes = themes.filter((theme) =>
    theme.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside
      className="bg-muted/30 border-r border-muted/40 h-full flex flex-col items-center py-2 px-1 gap-2 min-w-[72px] max-w-44 shadow-sm"
      aria-label="Panel de temas"
    >
      <div className="flex flex-col items-center w-full mb-2 px-2">
        <div className="flex items-center gap-1 w-full justify-between">
          <span className="text-xs font-semibold text-muted-foreground select-none">Temas</span>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-primary"
            title="Añadir tema"
            onClick={() => window.windowAPI.openThemeWindow()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tema..."
          className="w-full h-7 text-xs px-2 border-muted/40 bg-background"
        />
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto w-full px-2">
        {filteredThemes.map((theme) => (
          <ContextMenu key={theme.id}>
            <ContextMenuTrigger className="rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary">
              <PresentationView
                onClick={() => setSelectedTheme(theme)}
                selected={selectedTheme?.id === theme.id}
                theme={theme}
                items={[{ text: 'Preview Text' }]}
                className={`border ${selectedTheme?.id === theme.id ? 'border-primary' : 'border-muted/40'} bg-background cursor-pointer transition-all`}
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
    </aside>
  )
}
