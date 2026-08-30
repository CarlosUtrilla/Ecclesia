import { useState } from 'react'
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent
} from '@/ui/menubar'
import {
  ArrowLeftRight,
  BookOpen,
  Captions,
  Download,
  MonitorPlay,
  Music,
  Palette,
  Plus,
  Presentation,
  Radio,
  Timer,
  Upload,
  Wrench
} from 'lucide-react'
import ExportDialog from '@/screens/panels/library/ExportDialog'
import SongImporter from '@/screens/panels/library/songs/songImporter'
import ChurchCountdownDialog from './ChurchCountdownDialog'
import ObsTextOutputDialog from './ObsTextOutputDialog'
import NdiOutputDialog from './NdiOutputDialog'

type ExportResourceType = 'songs' | 'themes'

export default function AppMenubar() {
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportType, setExportType] = useState<ExportResourceType>('songs')
  const [songImporterOpen, setSongImporterOpen] = useState(false)
  const [countdownOpen, setCountdownOpen] = useState(false)
  const [obsOutputOpen, setObsOutputOpen] = useState(false)
  const [ndiOutputOpen, setNdiOutputOpen] = useState(false)

  const handleImportThemes = async () => {
    const selectedFiles = await window.mediaAPI.selectFiles('all')
    const zipFiles = selectedFiles.filter((f) => f.fileName.toLowerCase().endsWith('.zip'))

    if (zipFiles.length === 0) {
      window.alert('Selecciona al menos un archivo .zip válido para importar.')
      return
    }

    try {
      const results = await Promise.allSettled(
        zipFiles.map(async (zf) => {
          const formData = new FormData()
          const blob = new Blob([zf.bytes as BlobPart])
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
  }

  const handleImportBible = async () => {
    const selectedFiles = await window.mediaAPI.selectFiles('all')
    const ebblFiles = selectedFiles.filter((f) => f.fileName.toLowerCase().endsWith('.ebbl'))

    if (ebblFiles.length === 0) {
      window.alert('Selecciona al menos un archivo .ebbl válido para importar.')
      return
    }

    try {
      for (const ef of ebblFiles) {
        const formData = new FormData()
        const blob = new Blob([ef.bytes as BlobPart])
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
  }

  const handleExportSelect = (type: ExportResourceType) => {
    setExportType(type)
    setExportDialogOpen(true)
  }

  return (
    <>
      <Menubar className="h-9 rounded-none border-0 border-b bg-background px-2 shadow-none">
        <MenubarMenu>
          <MenubarTrigger className="text-xs">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => window.windowAPI.openThemeWindow()}>
              <Palette className="mr-2 h-4 w-4" />
              Nuevo tema
            </MenubarItem>
            <MenubarItem onClick={() => window.windowAPI.openSongWindow()}>
              <Music className="mr-2 h-4 w-4" />
              Nueva canción
            </MenubarItem>
            <MenubarItem onClick={() => window.windowAPI.openPresentationWindow()}>
              <Presentation className="mr-2 h-4 w-4" />
              Nueva presentación
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Importar/Exportar
          </MenubarTrigger>
          <MenubarContent>
            <MenubarSub>
              <MenubarSubTrigger>
                <Music className="mr-2 h-4 w-4" />
                Canciones
              </MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem onClick={() => setSongImporterOpen(true)}>
                  <Download className="mr-2 h-4 w-4" />
                  Importar
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={() => handleExportSelect('songs')}>
                  <Upload className="mr-2 h-4 w-4" />
                  Exportar...
                </MenubarItem>
              </MenubarSubContent>
            </MenubarSub>

            <MenubarSub>
              <MenubarSubTrigger>
                <Palette className="mr-2 h-4 w-4" />
                Temas
              </MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem onClick={handleImportThemes}>
                  <Download className="mr-2 h-4 w-4" />
                  Importar
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={() => handleExportSelect('themes')}>
                  <Upload className="mr-2 h-4 w-4" />
                  Exportar...
                </MenubarItem>
              </MenubarSubContent>
            </MenubarSub>

            <MenubarSub>
              <MenubarSubTrigger>
                <BookOpen className="mr-2 h-4 w-4" />
                Biblia
              </MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem onClick={handleImportBible}>
                  <Download className="mr-2 h-4 w-4" />
                  Importar
                </MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">
            <Wrench className="mr-2 h-4 w-4" />
            Herramientas
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setCountdownOpen(true)}>
              <Timer className="mr-2 h-4 w-4" />
              Cuenta atrás...
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">
            <MonitorPlay className="mr-2 h-4 w-4" />
            OBS
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setObsOutputOpen(true)}>
              <Captions className="mr-2 h-4 w-4" />
              Salida de texto (subtítulos)...
            </MenubarItem>
            <MenubarItem onClick={() => setNdiOutputOpen(true)}>
              <Radio className="mr-2 h-4 w-4" />
              Salida de vídeo (NDI)...
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        resourceType={exportType}
      />

      <SongImporter forceOpen={songImporterOpen} onOpenChange={setSongImporterOpen} />

      <ChurchCountdownDialog open={countdownOpen} onOpenChange={setCountdownOpen} />

      <ObsTextOutputDialog open={obsOutputOpen} onOpenChange={setObsOutputOpen} />

      <NdiOutputDialog open={ndiOutputOpen} onOpenChange={setNdiOutputOpen} />
    </>
  )
}
