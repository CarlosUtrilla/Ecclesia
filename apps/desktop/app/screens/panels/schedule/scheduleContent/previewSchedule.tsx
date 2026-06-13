import { Button } from '@/ui/button'
import { PresentationView } from '@/ui/PresentationView'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import type { ScheduleItem } from '@ecclesia/api'
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
      <div
        className="max-h-[28rem] w-md overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        ref={ref}
      >
        <div className="sticky top-0 z-10 bg-muted flex justify-between items-center px-2 py-2 border-y panel-header">
          <h3 className="font-medium text-sm italic">Vista previa</h3>
          <Button
            size="sm"
            onClick={() => {
              onLivePresentation(0)
            }}
          >
            Presentar en vivo <Radio className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid p-2 grid-cols-2 auto-rows-min gap-2">
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
      </div>
    )
  }
)
PreviewSchedule.displayName = 'PreviewSchedule'
export default PreviewSchedule
