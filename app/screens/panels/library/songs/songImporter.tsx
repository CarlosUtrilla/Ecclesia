import { useRef, useState } from 'react'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog'
import { Tooltip } from '@/ui/tooltip'
import { cn } from '@/lib/utils'
import { AppsImportersIcons } from '@/icons/appsImporters'
import { Download, FolderOpen, Upload } from 'lucide-react'
import { queryClient } from '@/main'

export default function SongImporter() {
  const [openDialog, setOpenDialog] = useState(false)
  const [selectedApp, setSelectedApp] = useState<string | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    if (selectedPaths.length > 0 && selectedApp) {
      try {
        await window.api.songs.importSongsFromFile(selectedPaths, selectedApp)
        setOpenDialog(false)
        queryClient.invalidateQueries({
          queryKey: ['songs', 'libraryPanel']
        })
      } catch (error) {
        console.error('Error importing songs:', error)
        setError('Ocurrió un error al importar las canciones. Por favor, intenta de nuevo.')
      }
    }
  }

  return (
    <Dialog
      open={openDialog}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedApp(null)
          setSelectedPaths([])
        }
        setOpenDialog(open)
      }}
    >
      <Tooltip content="Importar canciones">
        <DialogTrigger asChild>
          <Button size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      </Tooltip>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar canciones</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          <p className="text-sm text-muted-foreground">
            Elige la app desde la que deseas importar:
          </p>

          <div className="flex flex-wrap gap-3">
            {AppsImportersIcons.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedApp(app.id === selectedApp ? null : app.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedApp(app.id === selectedApp ? null : app.id)
                  }
                }}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border-2 w-24 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'hover:border-primary/60 hover:bg-muted/50',
                  selectedApp === app.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-transparent'
                )}
              >
                <img
                  src={app.icon}
                  alt={app.name}
                  className="h-10 w-10 object-contain rounded-md"
                />
                <span className="text-xs font-medium">{app.name}</span>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t">
            <input
              ref={fileInputRef}
              type="file"
              accept={AppsImportersIcons.find((a) => a.id === selectedApp)?.files}
              className="hidden"
              onChange={(e) => {
                const files = e.target.files
                if (!files || files.length === 0) return
                const paths = Array.from(files).map((f) => window.mediaAPI.getPathForFile(f))
                setSelectedPaths(paths)
                e.target.value = ''
              }}
              multiple
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled={!selectedApp}
                onClick={() => fileInputRef.current?.click()}
              >
                <FolderOpen className="h-4 w-4" />
                {selectedPaths.length > 0
                  ? `${selectedPaths.length} archivo(s) seleccionado(s)`
                  : 'Elegir archivo...'}
              </Button>
              <Button
                disabled={selectedPaths.length === 0}
                className="gap-2"
                onClick={handleImport}
              >
                <Upload className="h-4 w-4" />
                Importar
              </Button>
            </div>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
