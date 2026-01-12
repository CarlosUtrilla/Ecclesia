import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { Import } from 'lucide-react'
import { useMediaOperations } from '../media/hooks/useMediaOperations'

export default function ImportBibleButton() {
  const operations = useMediaOperations('../../bible')
  const handleImportBible = async () => {
    try {
      const filePaths = await window.mediaAPI.selectBibleFile()
      if (filePaths?.length) {
        await operations.importMutation.mutateAsync(filePaths)
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
