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
import { Download, Edit, ExternalLink, Plus, Trash2, Upload } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/ui/popover'

// Nuevo diseño: panel lateral compacto, no compite visualmente
import { useState } from 'react'
import { Input } from '@/ui/input'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/ui/scroll-area'

export function ThemesSidePanel() {
  const { themes, refetchThemes } = useThemes()
  const { selectedTheme, setSelectedTheme } = useSchedule()
  const [search, setSearch] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)

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

  const handleExportarTema = async (themeId: number) => {
    try {
      const result = await window.api.themes.exportThemeToZip(themeId)
      window.alert(`Tema exportado correctamente en:\n${result.outputPath}`)
    } catch (error: any) {
      window.alert(error?.message ?? 'No se pudo exportar el tema')
    }
  }

  const handleImportarTemas = async () => {
    try {
      const selectedPaths = await window.mediaAPI.selectFiles('all')
      const zipPaths = selectedPaths.filter((filePath) => filePath.toLowerCase().endsWith('.zip'))

      if (zipPaths.length === 0) {
        window.alert('Selecciona al menos un archivo .zip válido para importar.')
        return
      }

      const results = await Promise.allSettled(
        zipPaths.map((zipPath) => window.api.themes.importThemeFromZip(zipPath))
      )

      const successCount = results.filter((item) => item.status === 'fulfilled').length
      const errorCount = results.length - successCount
        const renamedMediaImports = results
          .filter((item) => item.status === 'fulfilled')
          .map((item) => item.value)
          .filter((item) => item.backgroundMediaWasRenamed)

      if (successCount > 0) {
        window.electron.ipcRenderer.send('theme-saved')
        refetchThemes()
      }

      if (errorCount === 0) {
          const renamedSummary =
            renamedMediaImports.length > 0
              ? `\n\nSe renombró el archivo de fondo en ${renamedMediaImports.length} tema(s) por conflicto de nombre:\n${renamedMediaImports
                  .map((item) => `- ${item.themeName}: ${item.backgroundMediaFilePath ?? 'ruta no disponible'}`)
                  .join('\n')}`
              : ''

          window.alert(`Se importaron ${successCount} tema(s) correctamente.${renamedSummary}`)
        return
      }

      const firstError = results.find((item) => item.status === 'rejected')
      const message =
        firstError && firstError.status === 'rejected'
          ? (firstError.reason as Error)?.message
          : 'Error desconocido'

      window.alert(`Importación finalizada con errores.\nÉxitos: ${successCount}\nErrores: ${errorCount}\n\n${message}`)
    } catch (error: any) {
      window.alert(error?.message ?? 'No se pudieron importar los temas')
    }
  }

  // Filtrar temas por nombre
  const filteredThemes = themes.filter((theme) =>
    theme.name?.toLowerCase().includes(search.toLowerCase())
  )

  const themeGrid = (fullMode: boolean = false) => (
    <>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar tema..."
        className="w-full h-7 my-2 text-xs px-2 border-muted/40 bg-background"
      />

      {filteredThemes.length === 0 ? (
        <div
          className={cn('col-span-full m-auto text-center text-sm text-muted-foreground py-4', {
            'text-xl': fullMode
          })}
        >
          No se encontraron temas.
        </div>
      ) : (
        <ScrollArea className="panel-scroll-content flex-1 w-full px-2 pb-2">
          <div
            className={cn('grid grid-cols-2 gap-1.5', {
              'grid-cols-4': fullMode
            })}
          >
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
                        onClick={() => {
                          setSelectedTheme(theme)
                          setPopoverOpen(false)
                        }}
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
                    <ContextMenuItem onClick={() => handleExportarTema(theme.id)}>
                      <Download /> Exportar tema (.zip)
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
      )}
    </>
  )

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <aside
        id="theme-selector"
        className="@container gap-0 panel-scrollable relative flex-1 min-h-0 overflow-hidden bg-muted/30 border-r border-muted/40 flex flex-col items-stretch py-2 px-1 shadow-sm"
        aria-label="Panel de temas"
      >
        <div className="panel-header flex flex-col items-center w-full px-2">
          <div className="flex items-center gap-1 w-full justify-between">
            <span className="text-xs font-semibold text-muted-foreground select-none">Temas</span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-primary"
                title="Añadir tema"
                onClick={() => window.windowAPI.openThemeWindow()}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-primary"
                title="Importar tema (.zip)"
                onClick={handleImportarTemas}
              >
                <Upload className="w-4 h-4" />
              </Button>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" title="Ver temas expandido">
                  <ExternalLink className="w-4 h-4 text-primary" />
                </Button>
              </PopoverTrigger>
            </div>
          </div>
        </div>

        {themeGrid()}
        {/* Anchor al borde inferior-izquierdo del aside para posicionar el popover */}
        <PopoverAnchor className="absolute bottom-0 left-0 right-0 h-0 pointer-events-none" />
      </aside>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-5xl max-w-[60vw] p-2 !h-[calc(70dvh)] max-h-[calc(70dvh)] panel-scrollable"
      >
        {themeGrid(true)}
      </PopoverContent>
    </Popover>
  )
}
