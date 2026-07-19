import { useRef, useState, useEffect } from 'react'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog'
import { Tooltip } from '@/ui/tooltip'
import { cn } from '@/lib/utils'
import { AppsImportersIcons } from '@/icons/appsImporters'
import { Download, FolderOpen, Upload } from 'lucide-react'
import { Api } from '@ecclesia/queries'
import { TagPreviewDialog, MissingTag } from './TagPreviewDialog'

interface SongImporterProps {
  forceOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function SongImporter({ forceOpen, onOpenChange }: SongImporterProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = forceOpen !== undefined
  const openDialog = isControlled ? forceOpen : internalOpen
  const setOpenDialog = isControlled ? onOpenChange! : setInternalOpen

  const [selectedApp, setSelectedApp] = useState<string | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const [missingTags, setMissingTags] = useState<MissingTag[] | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)

  useEffect(() => {
    if (!openDialog) {
      setSelectedApp(null)
      setSelectedPaths([])
      setMissingTags(null)
      setError(null)
    }
  }, [openDialog])

  const doImport = async (tagsToCreate: MissingTag[]) => {
    try {
      if (tagsToCreate.length > 0) {
        for (const tag of tagsToCreate) {
          const shortName =
            tag.verseName
              .trim()
              .split(/\s+/)
              .map((w) => w.charAt(0).toUpperCase())
              .join('')
              .substring(0, 4) || 'TAG'

          await Api.fetch.tagSongs.createTagSongs({
            body: {
              name: tag.verseName,
              shortName,
              color: tag.color,
              deletedAt: null
            }
          })
        }
      }

      await Api.fetch.songs.importSongsFromFile({
        body: { filesPath: selectedPaths, source: selectedApp!, createTags: true }
      })
      setOpenDialog(false)
    } catch (err) {
      console.error('Error importing songs:', err)
      setError('Ocurrió un error al importar las canciones. Por favor, intenta de nuevo.')
    }
  }

  const doImportWithoutTags = async () => {
    try {
      await Api.fetch.songs.importSongsFromFile({
        body: { filesPath: selectedPaths, source: selectedApp!, createTags: false }
      })
      setOpenDialog(false)
    } catch (err) {
      console.error('Error importing songs:', err)
      setError('Ocurrió un error al importar las canciones. Por favor, intenta de nuevo.')
    }
  }

  const handleImport = async () => {
    if (selectedPaths.length === 0 || !selectedApp) return
    setError(null)
    setIsPreviewing(true)
    try {
      if (selectedApp === 'ecclesia') {
        await doImport([])
      } else {
        const result = await Api.fetch.songs.previewMissingTags({
          body: { filesPath: selectedPaths, source: selectedApp }
        })
        if (result.missingTags.length > 0) {
          setMissingTags(result.missingTags)
        } else {
          await doImport([])
        }
      }
    } catch (err) {
      console.error('Error importing songs:', err)
      setError('Ocurrió un error al analizar las canciones. Por favor, intenta de nuevo.')
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleDialogClose = (isOpen: boolean) => {
    setOpenDialog(isOpen)
  }

  const triggerButton = (
    <Tooltip content="Importar canciones">
      <DialogTrigger asChild>
        <Button size="icon">
          <Download className="h-4 w-4" />
        </Button>
      </DialogTrigger>
    </Tooltip>
  )

  return (
    <>
      <Dialog open={openDialog} onOpenChange={handleDialogClose}>
        {!isControlled && triggerButton}
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
                  disabled={selectedPaths.length === 0 || isPreviewing}
                  className="gap-2"
                  onClick={handleImport}
                >
                  <Upload className="h-4 w-4" />
                  {isPreviewing ? 'Analizando...' : 'Importar'}
                </Button>
              </div>
              {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TagPreviewDialog
        open={missingTags !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setMissingTags(null)
        }}
        tags={missingTags ?? []}
        onConfirm={(confirmedTags) => {
          setMissingTags(null)
          doImport(confirmedTags)
        }}
        onSkip={() => {
          setMissingTags(null)
          doImportWithoutTags()
        }}
      />
    </>
  )
}