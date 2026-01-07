import { MediaCard } from './MediaCard'
import { FolderCard } from './FolderCard'
import { Media } from '@prisma/client'

interface MediaGridProps {
  items: Media[]
  folders: string[]
  onDelete: (media: Media) => void
  onDeleteFolder: (folderName: string) => void
  onNavigateToFolder: (folderName: string) => void
  onCopy: (item: Media | string, isFolder: boolean) => void
  onCut: (item: Media | string, isFolder: boolean) => void
  onRename: (item: Media | string, isFolder: boolean, currentName: string) => void
  formatFileSize: (bytes: number) => string
}

export function MediaGrid({
  items,
  folders,
  onDelete,
  onDeleteFolder,
  onNavigateToFolder,
  onCopy,
  onCut,
  onRename,
  formatFileSize
}: MediaGridProps) {
  if (folders.length === 0 && items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No hay medios disponibles</p>
        <p className="text-sm mt-1">Importa imágenes o videos para comenzar</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Carpetas */}
      {folders.map((folderName) => (
        <FolderCard
          key={folderName}
          folderName={folderName}
          onNavigate={onNavigateToFolder}
          onDelete={onDeleteFolder}
          onCopy={onCopy}
          onCut={onCut}
          onRename={onRename}
        />
      ))}

      {/* Archivos */}
      {items.map((media) => (
        <MediaCard
          key={media.id}
          media={media}
          onDelete={onDelete}
          onCopy={onCopy}
          onCut={onCut}
          onRename={onRename}
          formatFileSize={formatFileSize}
        />
      ))}
    </div>
  )
}
