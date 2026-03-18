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
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/ui/scroll-area'

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
      id="theme-selector"
      className="@container panel-scrollable flex-1 min-h-0 overflow-hidden bg-muted/30 border-r border-muted/40 flex flex-col items-stretch py-2 px-1 gap-2 shadow-sm"
      aria-label="Panel de temas"
    >
      <div className="panel-header flex flex-col items-center w-full mb-2 px-2">
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
      <ScrollArea className="panel-scroll-content h-0 flex-1 w-full px-2 pb-2">
        <div className="grid grid-cols-2 @max-[250px]:grid-cols-1 gap-1.5">
          {filteredThemes.map((theme, index) => {
            const isSelected = selectedTheme?.id === theme.id
            return (
              <ContextMenu key={theme.id}>
                <ContextMenuTrigger
                  asChild
                  className="relative rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="p-[3px]">
                    <PresentationView
                      onClick={() => setSelectedTheme(theme)}
                      selected={isSelected}
                      theme={theme}
                      items={[{ text: theme.name, resourceType: 'BIBLE' }]}
                      key={`theme-${index}-${theme.name?.slice(0, 20)}`}
                      className={cn(isSelected ? 'outline-primary' : '')}
                    />
                    <div className="absolute text-white bottom-[3px] rounded-b-md right-[3px] left-[3px] p-1 px-1.5 text-xs bg-black/50">
                      {theme.name}
                    </div>
                  </div>
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
            )
          })}
        </div>
      </ScrollArea>
    </aside>
  )
}
