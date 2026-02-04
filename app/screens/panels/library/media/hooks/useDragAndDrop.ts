import { useState, useRef } from 'react'
import { toast } from 'sonner'

interface UseDragAndDropProps {
  onFilesDropped: (files: string[]) => void
}

const VALID_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.mp4',
  '.webm',
  '.ogg',
  '.mov',
  '.avi'
]

const isExternalFile = (e: React.DragEvent) => {
  const hasFiles = e.dataTransfer.types.includes('Files')
  const hasInternalData = e.dataTransfer.types.includes('application/json')
  return hasFiles && !hasInternalData
}

const getFileExtension = (filename: string) => {
  return filename.toLowerCase().substring(filename.lastIndexOf('.'))
}

export function useDragAndDrop({ onFilesDropped }: UseDragAndDropProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isExternalFile(e)) {
      dragCounter.current++
      setIsDragging(true)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isExternalFile(e)) {
      dragCounter.current--
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsDragging(false)
      }
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    dragCounter.current = 0
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const validFiles = files.filter((file) =>
      VALID_EXTENSIONS.includes(getFileExtension(file.name))
    )

    if (validFiles.length === 0) {
      toast.error('No se encontraron archivos de imagen o video válidos')
      return
    }

    if (validFiles.length !== files.length) {
      toast.warning(`Se ignoraron ${files.length - validFiles.length} archivo(s) no válido(s)`)
    }

    try {
      const filePaths = validFiles.map((file) => window.mediaAPI.getPathForFile(file))

      await onFilesDropped(filePaths)
      toast.success(`Importando ${filePaths.length} archivo(s)...`)
    } catch (error) {
      toast.error('Error al procesar archivos', error as any)
    }
  }

  return {
    isDragging,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}
