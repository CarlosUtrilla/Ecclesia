import { Button } from '@/ui/button'
import { Import } from 'lucide-react'
import useBibleVersions from '@/hooks/useBibleVersions'

export default function ImportBibleButton() {
  const { refetch } = useBibleVersions()
  const handleImportBible = async () => {
    try {
      const files = await window.mediaAPI.selectBibleFiles()
      if (!files?.length) return

      for (const file of files) {
        const formData = new FormData()
        const blob = new Blob([new Uint8Array(file.bytes)], { type: 'application/octet-stream' })
        formData.append('file', blob, file.fileName)

        const response = await fetch('http://localhost:7777/api/bible/importBible', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(err)
        }
      }

      await refetch()
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
