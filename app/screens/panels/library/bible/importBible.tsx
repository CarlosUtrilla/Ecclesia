import { Button } from '@/ui/button'
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
    <Button className="text-xs" onClick={handleImportBible}>
      <Import className="w-4 h-4" /> Importar biblia
    </Button>
  )
}
