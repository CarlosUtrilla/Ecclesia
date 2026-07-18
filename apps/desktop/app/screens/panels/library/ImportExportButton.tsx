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

type ExportResourceType = 'songs' | 'themes'

export default function ImportExportButton() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportType, setExportType] = useState<ExportResourceType>('songs')

  const handleImportSongs = () => {
    // TODO: Open SongImporter dialog
    window.alert('Importar canciones - Próximamente')
    setIsDropdownOpen(false)
  }

  const handleImportThemes = async () => {
    // TODO: Open file picker for .zip files
    window.alert('Importar temas - Próximamente')
    setIsDropdownOpen(false)
  }

  const handleImportBible = async () => {
    // TODO: Open file picker for .ebbl files
    window.alert('Importar biblia - Próximamente')
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
              <DropdownMenuItem onClick={handleImportSongs}>
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
    </>
  )
}