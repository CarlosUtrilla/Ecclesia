import { useSchedule } from '..'
import { ScheduleItem } from '@prisma/client'
import { useEffect, useState } from 'react'

interface LibraryItemPreviewProps {
  item: ScheduleItem
}

export default function LibraryItemPreview({ item }: LibraryItemPreviewProps) {
  const { getScheduleItemLabel, getScheduleItemIcon } = useSchedule()
  const [label, setLabel] = useState('')

  useEffect(() => {
    const fetchLabel = async () => {
      const lbl = await getScheduleItemLabel(item)
      setLabel(lbl as string)
    }
    fetchLabel()
  }, [item, getScheduleItemLabel])

  // Para grupos, mostrar el nombre y color
  if (item.type === 'GROUP') {
    return (
      <div
        className="rounded-md border font-semibold text-base px-4 py-2 my-2 select-none shadow-xl min-w-[200px]"
        style={{
          background: (item as any).color || '#e0e0e0',
          color: '#222',
          opacity: 0.95
        }}
      >
        {(item as any).name || label || 'Grupo'}
      </div>
    )
  }

  // Para media, usar un card cuadrado similar al original
  if (item.type === 'MEDIA') {
    return (
      <div className="w-32 h-32 cursor-grabbing border border-border rounded-lg overflow-hidden bg-card shadow-xl">
        <div className="w-full h-full bg-muted/30 flex flex-col items-center justify-center p-2">
          <div className="text-xs text-primary mx-auto">{getScheduleItemIcon(item)}</div>
          <p className="text-xs text-center text-muted-foreground line-clamp-3 max-w-full">
            {label || 'Media'}
          </p>
        </div>
      </div>
    )
  }

  // Para otros tipos, usar el componente horizontal estándar
  return (
    <div className="p-3 py-1.5 bg-background border cursor-grabbing rounded-md shadow-xl min-w-[200px]">
      <div className="flex items-center gap-2">
        <span className="text-xs text-primary">{getScheduleItemIcon(item)}</span>
        <span className="text-sm font-medium">{label || item.type}</span>
      </div>
    </div>
  )
}
