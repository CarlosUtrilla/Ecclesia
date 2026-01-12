import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { Import } from 'lucide-react'
import { useMediaOperations } from '../media/hooks/useMediaOperations'
import useBibleVersions from '@/hooks/useBibleVersions'

export default function ImportBibleButton() {
  const { refetch } = useBibleVersions()
  const operations = useMediaOperations('../../bible')
  const handleImportBible = async () => {
    try {
      const filePaths = await window.bibleAPI.selectFiles()
      if (filePaths?.length) {
        await operations.importBibleMutation.mutateAsync(filePaths)
        await refetch()
      }
    } catch (error) {
      console.error('Error en importación:', error)
    }
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button onClick={handleImportBible}>
          <Import className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Importar biblia</TooltipContent>
    </Tooltip>
  )
}
