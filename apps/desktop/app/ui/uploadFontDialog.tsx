import { Dialog, DialogContent } from './dialog'
import { Button } from './button'
import { useRef, useState } from 'react'
import { getCustomFontFamily } from '@/lib/customFontUtils'
import { planFontUploads } from './uploadFontDialog.utils'

type UploadFontDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function UploadFontDialog({ open, onOpenChange }: UploadFontDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleUpload = async () => {
    setError(null)
    setSuccess(false)
    const files = fileInputRef.current?.files
    if (!files || files.length === 0) return

    setUploading(true)
    let anySuccess = false
    const allSelectedFiles = Array.from(files)

    const existingFonts = await window.api.fonts.getAllFonts()
    const uploadPlan = planFontUploads(
      allSelectedFiles.map((f) => f.name),
      existingFonts.map((f) => f.fileName)
    )

    const filesByName = new Map(allSelectedFiles.map((f) => [f.name, f] as const))

    for (const fileNameToUpload of uploadPlan.toUpload) {
      const file = filesByName.get(fileNameToUpload)
      if (!file) continue

      try {
        const fileBuffer = await file.arrayBuffer()
        const fileName = file.name
        const familyName = getCustomFontFamily(fileName)
        const res = await window.electron.ipcRenderer.invoke('fonts.uploadFont', {
          name: familyName || fileName.replace(/\.(ttf|otf)$/i, ''),
          fileName,
          fileBuffer
        })
        if (res.success) {
          anySuccess = true
        } else {
          setError(res.error || 'Error al subir fuente: ' + fileName)
        }
      } catch (err: any) {
        setError(err?.message || 'Error al subir fuente: ' + file.name)
      }
    }

    if (uploadPlan.skippedDuplicates.length > 0) {
      const duplicatedList = uploadPlan.skippedDuplicates.slice(0, 3).join(', ')
      const extraCount = Math.max(0, uploadPlan.skippedDuplicates.length - 3)
      setError(
        `Se omitieron ${uploadPlan.skippedDuplicates.length} archivo(s) duplicado(s): ${duplicatedList}${extraCount > 0 ? ` y ${extraCount} más` : ''}`
      )
    }

    setUploading(false)
    if (anySuccess) {
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onOpenChange(false)
      }, 900)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6 bg-background border border-primary/20 shadow-2xl">
        <div className="flex flex-col gap-4">
          <div>
            <span className="text-lg font-bold text-primary">Subir fuentes personalizadas</span>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Puedes seleccionar uno o varios archivos <span className="font-semibold">.ttf</span> o{' '}
              <span className="font-semibold">.otf</span> para añadir nuevas fuentes a tu
              biblioteca. Las variantes de una misma familia se detectan automáticamente.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ttf,.otf"
            multiple
            className="border border-primary/20 rounded px-3 py-2 bg-background/80 focus:outline-primary"
            disabled={uploading}
          />
          {error && <div className="text-red-500 text-xs font-medium">{error}</div>}
          {success && (
            <div className="text-green-600 text-xs font-medium">
              ¡Fuentes subidas correctamente!
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 bg-primary/90 hover:bg-primary text-white font-semibold rounded-lg shadow"
            >
              {uploading ? 'Subiendo...' : 'Subir fuente(s)'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
              className="flex-1 rounded-lg"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
