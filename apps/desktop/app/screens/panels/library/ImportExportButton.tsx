import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/ui/dropdown-menu'
import { ArrowDownUp, Music, Palette, BookOpen, Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { Tooltip } from '@/ui/tooltip'
import ExportDialog from './ExportDialog'
import SongImporter from './songs/songImporter'

type ExportResourceType = 'songs' | 'themes'

export default function ImportExportButton() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportType, setExportType] = useState<ExportResourceType>('songs')
  const [songImporterOpen, setSongImporterOpen] = useState(false)

  const handleImportThemes = async () => {
    const selectedFiles = await window.mediaAPI.selectFiles('all')
    const zipFiles = selectedFiles.filter((f) => f.fileName.toLowerCase().endsWith('.zip'))

    if (zipFiles.length === 0) {
      window.alert('Selecciona al menos un archivo .zip válido para importar.')
      setIsDropdownOpen(false)
      return
    }

    try {
      const { Api } = await import('@ecclesia/queries')
      const results = await Promise.allSettled(
        zipFiles.map(async (zf) => {
          const formData = new FormData()
          const blob = new Blob([zf.bytes])
          formData.append('file', blob, zf.fileName)
          const res = await fetch('http://localhost:7777/api/themes/importThemeZip', {
            method: 'POST',
            body: formData
          })
          if (!res.ok) throw new Error(await res.text())
          const data = await res.json()
          return data[0]
        })
      )

      const successCount = results.filter((item) => item.status === 'fulfilled').length
      if (successCount > 0) {
        window.alert(`Se importaron ${successCount} tema(s) correctamente.`)
      } else {
        window.alert('No se pudieron importar los temas.')
      }
    } catch {
      window.alert('Error al importar temas.')
    }
    setIsDropdownOpen(false)
  }

  const handleImportBible = async () => {
    const selectedFiles = await window.mediaAPI.selectFiles('all')
    const ebblFiles = selectedFiles.filter((f) => f.fileName.toLowerCase().endsWith('.ebbl'))

    if (ebblFiles.length === 0) {
      window.alert('Selecciona al menos un archivo .ebbl válido para importar.')
      setIsDropdownOpen(false)
      return
    }

    try {
      for (const ef of ebblFiles) {
        const formData = new FormData()
        const blob = new Blob([ef.bytes])
        formData.append('file', blob, ef.fileName)
        await fetch('http://localhost:7777/api/bible/importBible', {
          method: 'POST',
          body: formData
        })
      }
      window.alert('Biblia(s) importada(s) correctamente.')
    } catch {
      window.alert('Error al importar la biblia.')
    }
    setIsDropdownOpen(false)
  }

  const handleExportSelect = (type: ExportResourceType) => {
    setExportType(type)
    setExportDialogOpen(true)
    setIsDropdownOpen(false)
  }

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <Tooltip content="Importar / Exportar">
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <ArrowDownUp className="h-4 w-4 mr-1" />
              Importar / Exportar
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Music className="mr-2 h-4 w-4" />
              <span>Canciones</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => { setSongImporterOpen(true); setIsDropdownOpen(false) }}>
                <Download className="mr-2 h-4 w-4" />
                Importar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExportSelect('songs')}>
                <Upload className="mr-2 h-4 w-4" />
                Exportar...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette className="mr-2 h-4 w-4" />
              <span>Temas</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleImportThemes}>
                <Download className="mr-2 h-4 w-4" />
                Importar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExportSelect('themes')}>
                <Upload className="mr-2 h-4 w-4" />
                Exportar...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <BookOpen className="mr-2 h-4 w-4" />
              <span>Biblia</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleImportBible}>
                <Download className="mr-2 h-4 w-4" />
                Importar
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        resourceType={exportType}
      />

      <SongImporter forceOpen={songImporterOpen} onOpenChange={setSongImporterOpen} />
    </>
  )
}