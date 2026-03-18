import { Button } from '@/ui/button'
import { PresentationView } from '@/ui/PresentationView'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { ScrollArea } from '@/ui/scroll-area'
import type { ScheduleItem } from '@prisma/client'
import { Radio } from 'lucide-react'
import { useState } from 'react'

import { forwardRef } from 'react'

interface PreviewScheduleProps {
  itemContent: PresentationViewItems[]
  selectedItem: ScheduleItem
  selectedTheme: any
  onLivePresentation: (index: number) => void
  previewRef?: React.RefObject<HTMLDivElement>
}

const PreviewSchedule = forwardRef<HTMLDivElement, Omit<PreviewScheduleProps, 'previewRef'>>(
  ({ itemContent, selectedTheme, onLivePresentation }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    return (
      <div className="flex flex-col h-5/12" ref={ref}>
        <div className="flex justify-between items-center px-2 py-2 border-y bg-muted/20">
          <h3 className="font-medium text-sm italic">Vista previa de pantallas en vivo</h3>
          <Button
            size="sm"
            onClick={() => {
              onLivePresentation(0)
            }}
          >
            Presentar en vivo <Radio className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea>
          <div className="grid flex-1 p-2 grid-cols-2 auto-rows-min gap-2 h-full">
            {itemContent.map((content, index) => (
              <PresentationView
                tagSongId={(content as any).tagSongId}
                key={`preview-${index}-${content.text?.slice(0, 20)}`}
                items={[content]}
                theme={selectedTheme}
                onClick={(e) => {
                  // Si es doble click, presentar en vivo
                  if (e!.detail === 2) {
                    onLivePresentation(index)
                  }
                  setSelectedIndex(index)
                }}
                selected={selectedIndex === index}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }
)
PreviewSchedule.displayName = 'PreviewSchedule'
export default PreviewSchedule
