import { useState, useEffect, useRef } from 'react'
import { Plus, Search, FolderPlus, ChevronRight, Home, LayoutGrid, List } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Tooltip } from '@/ui/tooltip'
import { MediaFilterDto } from 'database/controllers/media/media.dto'
import { Media } from './types'
import { MediaGridWrapper } from './MediaGridWrapper'
import { MediaList } from './MediaList'
import { NewFolderDialog } from './NewFolderDialog'
import { RenameDialog } from './RenameDialog'
import { useMediaOperations } from './hooks/useMediaOperations'
import { useClipboard } from './hooks/useClipboard'
import { useSelection, SelectableItem } from './hooks/useSelection'
import { useKeyboardShortcuts } from '../../../../hooks/useKeyboardShortcuts'
import { useDragAndDrop } from './hooks/useDragAndDrop'
import { formatFileSize, stripFilesPrefix, buildFolderPath, normalizeFolder } from './utils'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/ui/resizable'

export default function MediaLibrary() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{
    item: Media | string
    isFolder: boolean
    currentName: string
  } | null>(null)
  const [conversionProgress, setConversionProgress] = useState<{
    fileName: string
    progress: number
  } | null>(null)

  const operations = useMediaOperations(currentFolder)
  const { clipboard, copy, cut, clear, getSourcePath } = useClipboard(currentFolder)
  const selection = useSelection()

  // Drag and drop para importar archivos
  const dragAndDrop = useDragAndDrop({
    onFilesDropped: (filePaths) => {
      operations.importMutation.mutate(filePaths)
    }
  })

  // Queries
  const { data: mediaData, isLoading } = useQuery({
    queryKey: ['media', searchTerm, currentFolder],
    queryFn: async () => {
      const params: MediaFilterDto = searchTerm ? { search: searchTerm } : {}
      const allMedia = await window.api.media.findAll(params)

      const filteredItems = allMedia.items.filter(
        (item: Media) => normalizeFolder(item.folder) === currentFolder
      )

      return { ...allMedia, items: filteredItems }
    }
  })

  const { data: folders = [] } = useQuery({
    queryKey: ['folders', currentFolder],
    queryFn: () => window.mediaAPI.listFolders(currentFolder || undefined)
  })

  const mediaItems = mediaData?.items || []
  const allSelectableItems: SelectableItem[] = [...folders, ...mediaItems]

  // Escuchar progreso de conversión de video
  useEffect(() => {
    const unsubscribe = window.mediaAPI.onImportProgress(({ progress, fileName }) => {
      setConversionProgress({ fileName, progress })

      if (progress >= 100) {
        setTimeout(() => {
          setConversionProgress(null)
        }, 500)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Limpiar selección cuando cambie de carpeta
  useEffect(() => {
    selection.clearSelection()
  }, [currentFolder])

  // Handlers de clipboard con selección múltiple
  const handleCopySelection = () => {
    const selected = selection.getSelectedItems(allSelectableItems)
    if (selected.length === 0) return
    copy(selected)
  }

  const handleCutSelection = () => {
    const selected = selection.getSelectedItems(allSelectableItems)
    if (selected.length === 0) return
    cut(selected)
  }

  // Handlers para elementos individuales (menú contextual)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCopySingle = (item: Media | string, _isFolder: boolean) => {
    copy([item])
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCutSingle = (item: Media | string, _isFolder: boolean) => {
    cut([item])
  }

  const handleDeleteSelection = async () => {
    const selected = selection.getSelectedItems(allSelectableItems)
    if (selected.length === 0) return

    const message =
      selected.length === 1
        ? `¿Eliminar "${typeof selected[0] === 'string' ? selected[0] : selected[0].name}"?`
        : `¿Eliminar ${selected.length} elementos?`

    if (!confirm(message)) return

    try {
      for (const item of selected) {
        if (typeof item === 'string') {
          await operations.deleteFolderMutation.mutateAsync(item)
        } else {
          await operations.deleteMutation.mutateAsync(item)
        }
      }
      selection.clearSelection()
    } catch (error) {
      console.error('Error al eliminar:', error)
      alert('Error al eliminar algunos elementos')
    }
  }

  // Handlers
  const handleImport = async () => {
    try {
      const filePaths = await window.mediaAPI.selectFiles('all')
      if (filePaths.length > 0) {
        await operations.importMutation.mutateAsync(filePaths)
      }
    } catch (error) {
      console.error('Error en importación:', error)
    }
  }

  const handleDelete = async (media: Media) => {
    if (!confirm(`¿Eliminar "${media.name}"?`)) return
    try {
      await operations.deleteMutation.mutateAsync(media)
    } catch (error) {
      console.error('Error al eliminar medio:', error)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await operations.createFolderMutation.mutateAsync(newFolderName.trim())
      setShowNewFolderDialog(false)
      setNewFolderName('')
    } catch (error) {
      console.error('Error al crear carpeta:', error)
    }
  }

  const handleDeleteFolder = async (folderName: string) => {
    if (!confirm(`¿Eliminar la carpeta "${folderName}"?`)) return
    try {
      await operations.deleteFolderMutation.mutateAsync(folderName)
    } catch (error: any) {
      alert(error.message || 'Error al eliminar carpeta')
    }
  }

  const handleRename = async (newName: string) => {
    if (!renameTarget || !newName.trim()) return

    try {
      const oldPath =
        typeof renameTarget.item === 'string'
          ? buildFolderPath(currentFolder, renameTarget.item)
          : stripFilesPrefix(renameTarget.item.filePath)

      const mediaId = typeof renameTarget.item === 'object' ? renameTarget.item.id : undefined

      await operations.renameMutation.mutateAsync({
        oldPath,
        newName: newName.trim(),
        isFolder: renameTarget.isFolder,
        mediaId
      })
    } catch (error: any) {
      console.error('Error en handleRename:', error)
      alert(error.message || 'Error al renombrar')
    } finally {
      setShowRenameDialog(false)
      setRenameTarget(null)
    }
  }

  const handlePaste = async () => {
    if (!clipboard) return

    try {
      for (const clipItem of clipboard.items) {
        const sourcePath = getSourcePath(clipItem.item, clipItem.sourceFolder)
        const mediaId = typeof clipItem.item === 'object' ? clipItem.item.id : undefined

        if (clipboard.type === 'cut') {
          await operations.moveMutation.mutateAsync({
            sourcePath,
            targetFolder: currentFolder,
            isFolder: clipItem.isFolder,
            mediaId
          })
        } else {
          const originalMedia = typeof clipItem.item === 'object' ? clipItem.item : undefined
          await operations.copyMutation.mutateAsync({
            sourcePath,
            targetFolder: currentFolder,
            isFolder: clipItem.isFolder,
            originalMedia
          })
        }
      }

      if (clipboard.type === 'cut') {
        clear()
      }
    } catch (error: any) {
      console.error('Error al pegar:', error)
      alert(error.message || 'Error al pegar los elementos')
    }
  }

  const handleDrop = async (
    droppedItem: { item: Media | string; isFolder: boolean },
    targetFolder: string | null
  ) => {
    try {
      const sourceFolder =
        typeof droppedItem.item === 'string'
          ? currentFolder
          : normalizeFolder(droppedItem.item.folder)

      // No mover si es la misma ubicación
      if (sourceFolder === targetFolder) return

      const sourcePath =
        typeof droppedItem.item === 'string'
          ? buildFolderPath(currentFolder, droppedItem.item)
          : stripFilesPrefix(droppedItem.item.filePath)

      const mediaId = typeof droppedItem.item === 'object' ? droppedItem.item.id : undefined

      await operations.moveMutation.mutateAsync({
        sourcePath,
        targetFolder,
        isFolder: droppedItem.isFolder,
        mediaId
      })
    } catch (error: any) {
      console.error('Error en handleDrop:', error)
      alert(error.message || 'Error al mover el elemento')
    }
  }

  const navigateToFolder = (folderName: string | null) => {
    setCurrentFolder(folderName ? buildFolderPath(currentFolder, folderName) : null)
  }

  const breadcrumbs = currentFolder?.split('/') || []
  const loading =
    isLoading || operations.importMutation.isPending || operations.deleteMutation.isPending

  // Atajos de teclado - Debe estar después de todas las definiciones de handlers
  const { handleItemClick: handleKeyboardItemClick } = useKeyboardShortcuts(containerRef, {
    onCopy: handleCopySelection,
    onCut: handleCutSelection,
    onPaste: handlePaste,
    onDelete: handleDeleteSelection,
    onSelectAll: () => selection.selectAll(allSelectableItems),
    onNavigate: (direction, extendSelection = false) => {
      // En vista flexbox, calcular columnas basándose en el ancho disponible
      // Aproximadamente 100px por item (24 * 4 + gaps)
      const containerWidth = containerRef.current?.clientWidth || 400
      const sidebarWidth = 192 // 48 * 4 = w-48
      const availableWidth = containerWidth - sidebarWidth - 16 // padding
      const itemWidth = 100 // ancho aproximado de cada item
      const columnsPerRow =
        viewMode === 'list' ? 1 : Math.max(1, Math.floor(availableWidth / itemWidth))
      selection.navigateSelection(direction, allSelectableItems, columnsPerRow, extendSelection)
    },
    onItemClick: (item: SelectableItem, e: React.MouseEvent) => {
      containerRef.current?.focus()
      if (e.shiftKey) {
        selection.selectRange(item, allSelectableItems)
      } else if (e.ctrlKey || e.metaKey) {
        selection.toggleSelect(item)
      } else {
        selection.selectSingle(item)
      }
    }
  })

  return (
    <div ref={containerRef} className="panel-scrollable relative">
      <ResizablePanelGroup className="flex h-full">
        {/* Sidebar izquierdo - Controles */}
        <ResizablePanel
          defaultSize={'20%'}
          minSize={'15%'}
          maxSize={'35%'}
          className="w-48 border-r bg-muted/10 panel-scrollable"
        >
          <div className="panel-header p-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">Biblioteca de Medios</h3>
              <div className="flex gap-1">
                <Tooltip content="Crear nueva carpeta">
                  <Button
                    onClick={() => setShowNewFolderDialog(true)}
                    size="sm"
                    className="text-xs"
                    disabled={loading}
                  >
                    <FolderPlus />
                  </Button>
                </Tooltip>
                <Tooltip content="Importar medios">
                  <Button onClick={handleImport} size="sm" className="text-xs" disabled={loading}>
                    <Plus />
                  </Button>
                </Tooltip>
              </div>
            </div>

            {/* Búsqueda */}
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>

            {/* Controles de vista */}
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">Vista</div>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-r-none h-7 flex-1 text-xs"
                  onClick={() => setViewMode('grid')}
                  title="Vista de cuadrícula"
                >
                  <LayoutGrid className="h-3 w-3 mr-1" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-l-none h-7 flex-1 text-xs"
                  onClick={() => setViewMode('list')}
                  title="Vista de lista"
                >
                  <List className="h-3 w-3 mr-1" />
                  Lista
                </Button>
              </div>
            </div>

            {/* Breadcrumbs compactos */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Ubicación</div>
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 justify-start text-xs"
                  onClick={() => navigateToFolder(null)}
                >
                  <Home className="h-2.5 w-2.5 mr-1" />
                  Raíz
                </Button>
                {breadcrumbs.map((crumb, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 justify-start text-xs ml-2"
                    onClick={() => {
                      const path = breadcrumbs.slice(0, index + 1).join('/')
                      setCurrentFolder(path)
                    }}
                  >
                    <ChevronRight className="h-2.5 w-2.5 mr-1" />
                    {crumb}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        {/* Área de contenido principal */}
        <ResizablePanel className="flex-1 panel-scrollable">
          <div
            className="panel-scroll-content p-2 relative"
            onDragEnter={dragAndDrop.handleDragEnter}
            onDragOver={dragAndDrop.handleDragOver}
            onDragLeave={dragAndDrop.handleDragLeave}
            onDrop={dragAndDrop.handleDrop}
          >
            {/* Overlay cuando se está arrastrando */}
            {dragAndDrop.isDragging && (
              <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-md flex items-center justify-center z-50">
                <div className="bg-background rounded-lg p-4 shadow-lg pointer-events-none">
                  <p className="text-sm font-semibold">Suelta los archivos aquí</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se importarán a {currentFolder || 'la raíz'}
                  </p>
                </div>
              </div>
            )}

            {/* Grid o Lista de medios */}
            <div className="h-full">
              {viewMode === 'grid' ? (
                <MediaGridWrapper
                  items={mediaItems}
                  folders={folders}
                  currentFolder={currentFolder}
                  onDelete={handleDelete}
                  onDeleteFolder={handleDeleteFolder}
                  onNavigateToFolder={navigateToFolder}
                  onCopy={handleCopySingle}
                  onCut={handleCutSingle}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onRename={(item, isFolder, currentName) => {
                    setRenameTarget({ item, isFolder, currentName })
                    setShowRenameDialog(true)
                  }}
                  formatFileSize={formatFileSize}
                  onItemClick={handleKeyboardItemClick}
                  isSelected={selection.isSelected}
                  onClearSelection={selection.clearSelection}
                />
              ) : (
                <MediaList
                  items={mediaItems}
                  folders={folders}
                  onDelete={handleDelete}
                  onDeleteFolder={handleDeleteFolder}
                  onNavigateToFolder={navigateToFolder}
                  onCopy={handleCopySingle}
                  onCut={handleCutSingle}
                  onRename={(item, isFolder, currentName) => {
                    setRenameTarget({ item, isFolder, currentName })
                    setShowRenameDialog(true)
                  }}
                  onItemClick={handleKeyboardItemClick}
                  isSelected={selection.isSelected}
                />
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {loading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            {conversionProgress ? (
              <>
                <p className="mt-2 text-sm font-medium">
                  Convirtiendo video &quot;{conversionProgress.fileName}&quot;
                </p>
                <div className="mt-2 w-48 mx-auto bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${conversionProgress.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {conversionProgress.progress}% - Optimizando para máxima compatibilidad
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Cargando...</p>
            )}
          </div>
        </div>
      )}

      <NewFolderDialog
        open={showNewFolderDialog}
        folderName={newFolderName}
        onOpenChange={(open) => {
          setShowNewFolderDialog(open)
          if (!open) setNewFolderName('')
        }}
        onFolderNameChange={setNewFolderName}
        onCreate={handleCreateFolder}
      />

      <RenameDialog
        open={showRenameDialog}
        initialName={renameTarget?.currentName || ''}
        onOpenChange={(open) => {
          setShowRenameDialog(open)
          if (!open) setRenameTarget(null)
        }}
        onRename={handleRename}
      />
    </div>
  )
}
