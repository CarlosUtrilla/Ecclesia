import { useState } from 'react'
import { Plus, Search, FolderPlus, ChevronRight, Home } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { MediaType } from '@prisma/client'
import { MediaFilterDto } from 'database/controllers/media/media.dto'
import { Media } from './types'
import { MediaGridWrapper } from './MediaGridWrapper'
import { NewFolderDialog } from './NewFolderDialog'
import { RenameDialog } from './RenameDialog'

export default function MediaLibrary() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | MediaType>('all')
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [clipboard, setClipboard] = useState<{
    type: 'copy' | 'cut'
    item: Media | string
    isFolder: boolean
  } | null>(null)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{
    item: Media | string
    isFolder: boolean
    currentName: string
  } | null>(null)
  const [renameName, setRenameName] = useState('')

  // Query para cargar medios
  const { data: mediaData, isLoading } = useQuery({
    queryKey: ['media', activeTab, searchTerm, currentFolder],
    queryFn: async () => {
      const params: MediaFilterDto = {}
      if (activeTab !== 'all') {
        params.type = activeTab as MediaType
      }
      if (searchTerm) {
        params.search = searchTerm
      }
      const allMedia = await window.api.media.findAll(params)

      // Filtrar por carpeta actual
      const filteredItems = allMedia.items.filter((item: Media) => {
        return item.folder === currentFolder
      })

      return { ...allMedia, items: filteredItems }
    }
  })

  // Query para carpetas
  const { data: folders = [] } = useQuery({
    queryKey: ['folders', currentFolder],
    queryFn: () => window.mediaAPI.listFolders(currentFolder || undefined)
  })

  const mediaItems = mediaData?.items || []

  // Mutation para importar archivos
  const importMutation = useMutation({
    mutationFn: async (filePaths: string[]) => {
      const results = []
      for (const filePath of filePaths) {
        const fileData = await window.mediaAPI.importFile(filePath, currentFolder || undefined)
        const media = await window.api.media.create(fileData)
        results.push(media as never)
      }
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
    }
  })

  // Mutation para crear carpeta
  const createFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      const folderPath = currentFolder ? `${currentFolder}/${folderName}` : folderName
      return await window.mediaAPI.createFolder(folderPath)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      handleCloseNewFolderDialog()
    }
  })

  // Mutation para eliminar carpeta
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      const folderPath = currentFolder ? `${currentFolder}/${folderName}` : folderName
      return await window.mediaAPI.deleteFolder(folderPath)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    }
  })

  // Mutation para renombrar
  const renameMutation = useMutation({
    mutationFn: async ({
      oldPath,
      newName,
      isFolder
    }: {
      oldPath: string
      newName: string
      isFolder: boolean
    }) => {
      return await window.mediaAPI.rename(oldPath, newName, isFolder)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      handleCloseRenameDialog()
    }
  })

  // Mutation para eliminar
  const deleteMutation = useMutation({
    mutationFn: async (media: Media) => {
      await window.api.media.delete(media.id.toString())
      await window.mediaAPI.deleteFile(media.filePath, media.thumbnail)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
    }
  })

  // Importar archivos
  const handleImport = async () => {
    try {
      const type: MediaType | 'all' = activeTab === 'all' ? 'all' : (activeTab as MediaType)
      const filePaths = await window.mediaAPI.selectFiles(type)

      if (filePaths.length === 0) return

      await importMutation.mutateAsync(filePaths)
    } catch (error) {
      console.error('Error en importación:', error)
    }
  }

  // Eliminar medio
  const handleDelete = async (media: Media) => {
    if (!confirm(`¿Eliminar "${media.name}"?`)) return

    try {
      await deleteMutation.mutateAsync(media)
    } catch (error) {
      console.error('Error al eliminar medio:', error)
    }
  }

  // Crear carpeta
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createFolderMutation.mutateAsync(newFolderName.trim())
    } catch (error) {
      console.error('Error al crear carpeta:', error)
    }
  }

  // Cerrar diálogo de nueva carpeta
  const handleCloseNewFolderDialog = () => {
    setShowNewFolderDialog(false)
    setNewFolderName('')
  }

  // Cerrar diálogo de renombrar
  const handleCloseRenameDialog = () => {
    setShowRenameDialog(false)
    setRenameTarget(null)
    setRenameName('')
  }

  // Eliminar carpeta
  const handleDeleteFolder = async (folderName: string) => {
    if (!confirm(`¿Eliminar la carpeta "${folderName}"?`)) return
    try {
      await deleteFolderMutation.mutateAsync(folderName)
    } catch (error: any) {
      alert(error.message || 'Error al eliminar carpeta')
    }
  }

  // Renombrar
  const handleRename = async () => {
    if (!renameTarget || !renameName.trim()) return

    try {
      let oldPath: string

      if (typeof renameTarget.item === 'string') {
        // Es una carpeta
        oldPath = currentFolder ? `${currentFolder}/${renameTarget.item}` : renameTarget.item
      } else {
        // Es un archivo - remover el prefijo "files/" del filePath
        const filePath = renameTarget.item.filePath
        oldPath = filePath.startsWith('files/') ? filePath.substring(6) : filePath
      }

      await renameMutation.mutateAsync({
        oldPath,
        newName: renameName.trim(),
        isFolder: renameTarget.isFolder
      })
    } catch (error: any) {
      alert(error.message || 'Error al renombrar')
    }
  }

  // Copiar
  const handleCopy = (item: Media | string, isFolder: boolean) => {
    setClipboard({ type: 'copy', item, isFolder })
  }

  // Cortar
  const handleCut = (item: Media | string, isFolder: boolean) => {
    setClipboard({ type: 'cut', item, isFolder })
  }

  // Pegar (placeholder - necesita implementación completa)
  const handlePaste = async () => {
    if (!clipboard) return

    // TODO: Implementar mover/copiar archivos
    alert('Funcionalidad de pegar en desarrollo')
    setClipboard(null)
  }

  // Navegar a carpeta
  const navigateToFolder = (folderName: string | null) => {
    if (folderName === null) {
      setCurrentFolder(null)
    } else {
      const newPath = currentFolder ? `${currentFolder}/${folderName}` : folderName
      setCurrentFolder(newPath)
    }
  }

  // Breadcrumbs
  const breadcrumbs = currentFolder ? currentFolder.split('/') : []

  // Formatear tamaño de archivo
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const loading = isLoading || importMutation.isPending || deleteMutation.isPending

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="p-3 border-b space-y-2">
        {/* Breadcrumbs */}
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

        {/* Barra de búsqueda y acciones */}
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
          <Button onClick={() => setShowNewFolderDialog(true)} size="sm" disabled={loading}>
            <FolderPlus className="h-4 w-4 mr-1" />
            Carpeta
          </Button>
          <Button onClick={handleImport} size="sm" disabled={loading}>
            <Plus className="h-4 w-4 mr-1" />
            Importar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="flex-1 flex flex-col"
      >
        <div className="px-3 pt-2">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="IMAGE">Imágenes</TabsTrigger>
            <TabsTrigger value="VIDEO">Videos</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <TabsContent value="all" className="mt-0">
            <MediaGridWrapper
              items={mediaItems}
              folders={folders}
              onDelete={handleDelete}
              onDeleteFolder={handleDeleteFolder}
              onNavigateToFolder={navigateToFolder}
              onCopy={handleCopy}
              onCut={handleCut}
              onPaste={handlePaste}
              onRename={(item, isFolder, currentName) => {
                setRenameTarget({ item, isFolder, currentName })
                setRenameName(currentName)
                setShowRenameDialog(true)
              }}
              formatFileSize={formatFileSize}
            />
          </TabsContent>
          <TabsContent value="IMAGE" className="mt-0">
            <MediaGridWrapper
              items={mediaItems}
              folders={folders}
              onDelete={handleDelete}
              onDeleteFolder={handleDeleteFolder}
              onNavigateToFolder={navigateToFolder}
              onCopy={handleCopy}
              onCut={handleCut}
              onPaste={handlePaste}
              onRename={(item, isFolder, currentName) => {
                setRenameTarget({ item, isFolder, currentName })
                setRenameName(currentName)
                setShowRenameDialog(true)
              }}
              formatFileSize={formatFileSize}
            />
          </TabsContent>
          <TabsContent value="VIDEO" className="mt-0">
            <MediaGridWrapper
              items={mediaItems}
              folders={folders}
              onDelete={handleDelete}
              onDeleteFolder={handleDeleteFolder}
              onNavigateToFolder={navigateToFolder}
              onCopy={handleCopy}
              onCut={handleCut}
              onPaste={handlePaste}
              onRename={(item, isFolder, currentName) => {
                setRenameTarget({ item, isFolder, currentName })
                setRenameName(currentName)
                setShowRenameDialog(true)
              }}
              formatFileSize={formatFileSize}
            />
          </TabsContent>
        </div>
      </Tabs>

      {loading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Cargando...</p>
          </div>
        </div>
      )}

      {/* Diálogos */}
      <NewFolderDialog
        open={showNewFolderDialog}
        folderName={newFolderName}
        onOpenChange={handleCloseNewFolderDialog}
        onFolderNameChange={setNewFolderName}
        onCreate={handleCreateFolder}
      />

      <RenameDialog
        open={showRenameDialog}
        name={renameName}
        onOpenChange={handleCloseRenameDialog}
        onNameChange={setRenameName}
        onRename={handleRename}
      />
    </div>
  )
}
