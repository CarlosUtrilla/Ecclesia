import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Search, Home, ChevronRight, LayoutGrid, List } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { MediaFilterDto, MediaDto } from 'database/controllers/media/media.dto'
import { Media, MediaType } from './types'
import { MediaGrid } from './MediaGrid'
import { MediaList } from './MediaList'
import { formatFileSize, normalizeFolder, buildFolderPath } from './utils'
import { useMediaOperations } from './hooks/useMediaOperations'
import { useDragAndDrop } from './hooks/useDragAndDrop'

interface MediaPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (media: Media) => void
  filterType?: MediaType // 'IMAGE' o 'VIDEO'
  title?: string
}

export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  filterType,
  title = 'Seleccionar archivo'
}: MediaPickerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)

  const operations = useMediaOperations(currentFolder)

  // Drag and drop para importar archivos
  const dragAndDrop = useDragAndDrop({
    onFilesDropped: (filePaths) => {
      operations.importMutation.mutate(filePaths)
    }
  })

  const { data: mediaData, isLoading } = useQuery({
    queryKey: ['media', searchTerm, currentFolder, filterType],
    queryFn: async () => {
      const params: MediaFilterDto = {
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(filterType ? { type: filterType } : {})
      }
      const allMedia = await window.api.media.findAll(params)

      const filteredItems = allMedia.items.filter(
        (item: MediaDto) => normalizeFolder(item.folder) === currentFolder
      )

      return { ...allMedia, items: filteredItems as Media[] }
    }
  })

  const { data: folders = [] } = useQuery({
    queryKey: ['folders', currentFolder],
    queryFn: () => window.mediaAPI.listFolders(currentFolder || undefined)
  })

  const mediaItems = mediaData?.items || []
  const breadcrumbs = currentFolder?.split('/') || []

  const handleSelect = () => {
    if (selectedMedia) {
      onSelect(selectedMedia)
      onOpenChange(false)
      setSelectedMedia(null)
      setCurrentFolder(null)
    }
  }

  const navigateToFolder = (folderName: string | null) => {
    setCurrentFolder(folderName ? buildFolderPath(currentFolder, folderName) : null)
    setSelectedMedia(null)
  }

  const handleItemClick = (item: Media) => {
    setSelectedMedia(item)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Selecciona un archivo de la biblioteca de medios
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header - Búsqueda y vista */}
          <div className="px-6 py-3 border-b">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar medios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => setViewMode('grid')}
                  title="Vista de cuadrícula"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => setViewMode('list')}
                  title="Vista de lista"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="px-6 py-3 border-b">
            <div className="flex items-center gap-1 text-sm">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => navigateToFolder(null)}
              >
                <Home className="h-3 w-3" />
              </Button>
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      const path = breadcrumbs.slice(0, index + 1).join('/')
                      setCurrentFolder(path)
                    }}
                  >
                    {crumb}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Grid/List */}
          <div
            className="flex-1 overflow-auto px-6 py-3 relative"
            onDragEnter={dragAndDrop.handleDragEnter}
            onDragOver={dragAndDrop.handleDragOver}
            onDragLeave={dragAndDrop.handleDragLeave}
            onDrop={dragAndDrop.handleDrop}
          >
            {/* Overlay cuando se está arrastrando */}
            {dragAndDrop.isDragging && (
              <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-md flex items-center justify-center z-50">
                <div className="bg-background rounded-lg p-8 shadow-lg pointer-events-none">
                  <p className="text-lg font-semibold">Suelta los archivos aquí</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Se importarán a {currentFolder || 'la raíz'}
                  </p>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : viewMode === 'grid' ? (
              <MediaGrid
                items={mediaItems}
                folders={folders}
                currentFolder={currentFolder}
                onDelete={() => {}}
                onDeleteFolder={() => {}}
                onNavigateToFolder={navigateToFolder}
                onCopy={() => {}}
                onCut={() => {}}
                onRename={() => {}}
                onDrop={() => {}}
                formatFileSize={formatFileSize}
                onItemClick={(item, e) => {
                  if (typeof item !== 'string') {
                    e.preventDefault()
                    handleItemClick(item)
                  } else {
                    navigateToFolder(item)
                  }
                }}
                isSelected={(item) => {
                  if (typeof item === 'string') return false
                  return selectedMedia?.id === item.id
                }}
              />
            ) : (
              <MediaList
                items={mediaItems}
                folders={folders}
                onDelete={() => {}}
                onDeleteFolder={() => {}}
                onNavigateToFolder={navigateToFolder}
                onCopy={() => {}}
                onCut={() => {}}
                onRename={() => {}}
                onItemClick={(item, e) => {
                  if (typeof item !== 'string') {
                    e.preventDefault()
                    handleItemClick(item)
                  } else {
                    navigateToFolder(item)
                  }
                }}
                isSelected={(item) => {
                  if (typeof item === 'string') return false
                  return selectedMedia?.id === item.id
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {selectedMedia ? (
              <span>
                Seleccionado: <strong>{selectedMedia.name}</strong> (
                {formatFileSize(selectedMedia.fileSize)})
              </span>
            ) : (
              <span>Selecciona un archivo</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSelect} disabled={!selectedMedia}>
              Seleccionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
