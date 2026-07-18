import { useState, useEffect } from 'react'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog'
import { Checkbox } from '@/ui/checkbox'
import { ScrollArea } from '@/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Api } from '@ecclesia/queries'

type ExportResourceType = 'songs' | 'themes'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resourceType: ExportResourceType
}

interface SelectableItem {
  id: number
  name: string
  selected: boolean
}

export default function ExportDialog({ open, onOpenChange, resourceType }: ExportDialogProps) {
  const [items, setItems] = useState<SelectableItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (open) {
      loadItems()
    }
  }, [open, resourceType])

  const loadItems = async () => {
    setIsLoading(true)
    try {
      if (resourceType === 'songs') {
        const result = await Api.fetch.songs.getSongsInfiniteScroll({
          body: { page: 1, limit: 1000 }
        })
        setItems(result.songs.map((s) => ({ id: s.id, name: s.title, selected: false })))
      } else if (resourceType === 'themes') {
        const result = await Api.fetch.themes.getAllThemes()
        setItems(result.map((t) => ({ id: t.id, name: t.name, selected: false })))
      }
    } catch (error) {
      console.error('Error loading items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleItem = (id: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)))
  }

  const toggleAll = () => {
    const allSelected = items.every((item) => item.selected)
    setItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })))
  }

  const selectedCount = items.filter((item) => item.selected).length

  const handleExport = async () => {
    const selectedIds = items.filter((item) => item.selected).map((item) => item.id)
    if (selectedIds.length === 0) return

    setIsExporting(true)
    try {
      if (resourceType === 'themes') {
        // Export each selected theme as ZIP
        for (const id of selectedIds) {
          await Api.fetch.themes.exportThemeToZip({ body: { id } })
        }
        window.alert(`Se exportaron ${selectedIds.length} tema(s) correctamente.`)
      } else if (resourceType === 'songs') {
        // TODO: Implement song export
        window.alert('Exportación de canciones próximamente')
      }
      onOpenChange(false)
    } catch (error) {
      console.error('Error exporting:', error)
      window.alert('Error al exportar. Por favor, intenta de nuevo.')
    } finally {
      setIsExporting(false)
    }
  }

  const title = resourceType === 'songs' ? 'Exportar Canciones' : 'Exportar Temas'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Cargando...</div>
        ) : (
          <>
            <div className="flex items-center space-x-2 py-2 border-b">
              <Checkbox
                id="select-all"
                checked={items.length > 0 && items.every((item) => item.selected)}
                onCheckedChange={toggleAll}
                className="cursor-pointer"
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer" onClick={toggleAll}>
                Seleccionar todos ({items.length})
              </label>
              {selectedCount > 0 && (
                <span className="ml-auto text-sm text-muted-foreground">
                  {selectedCount} seleccionado(s)
                </span>
              )}
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50',
                      item.selected && 'bg-muted'
                    )}
                  >
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm cursor-pointer" onClick={() => toggleItem(item.id)}>
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={selectedCount === 0 || isExporting}>
            {isExporting ? 'Exportando...' : `Exportar (${selectedCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}