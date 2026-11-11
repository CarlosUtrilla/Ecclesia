import { Button } from '@/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { PresentationView } from '@/ui/PresentationView'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import type { ScheduleItem } from '@ecclesia/api'
import { BookOpen, Radio } from 'lucide-react'
import { useState } from 'react'

import { forwardRef } from 'react'

interface PreviewScheduleProps {
  itemContent: PresentationViewItems[]
  selectedItem: ScheduleItem
  selectedTheme: any
  onLivePresentation: (index: number) => void
  previewRef?: React.RefObject<HTMLDivElement>
  /** Solo para items BIBLE: permite cambiar la versión antes de presentar. */
  bibleVersion?: {
    value: string
    options: { version: string; name: string }[]
    onChange: (version: string) => void
  }
}

// Algunas biblias importadas usan el nombre completo como código de versión.
const normalizeLabel = (value: string) => value.normalize('NFC').trim().toLowerCase()

const PreviewSchedule = forwardRef<HTMLDivElement, Omit<PreviewScheduleProps, 'previewRef'>>(
  ({ itemContent, selectedTheme, onLivePresentation, bibleVersion }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const currentBibleName = bibleVersion?.options.find(
      (bible) => bible.version === bibleVersion.value
    )?.name

    return (
      <div
        className="max-h-[28rem] w-md overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        ref={ref}
      >
        <div className="sticky top-0 z-10 bg-muted flex justify-between items-center px-2 py-2 border-y panel-header">
          <h3 className="font-medium text-sm italic">Vista previa</h3>
          <div className="flex items-center gap-2">
            {bibleVersion && bibleVersion.options.length > 0 && (
              <Select value={bibleVersion.value} onValueChange={bibleVersion.onChange}>
                <SelectTrigger
                  size="sm"
                  className="h-8 min-w-28 max-w-40 gap-2 bg-background px-3 font-semibold"
                  title={currentBibleName ?? 'Versión de la Biblia'}
                  aria-label="Versión de la Biblia"
                >
                  <BookOpen className="size-4 shrink-0 text-primary" />
                  <SelectValue>
                    <span className="truncate">{bibleVersion.value}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end" className="max-h-96 w-[26rem]">
                  {bibleVersion.options.map((bible) => {
                    const hasCode = normalizeLabel(bible.version) !== normalizeLabel(bible.name)
                    return (
                      <SelectItem key={bible.version} value={bible.version} className="py-2">
                        {/* Ancho fijo: ItemText es inline y sin él las columnas no alinean. */}
                        <span className="grid w-[23rem] grid-cols-[6rem_1fr] items-center gap-3">
                          {hasCode ? (
                            <>
                              <span className="truncate font-semibold">{bible.version}</span>
                              <span className="truncate text-muted-foreground">{bible.name}</span>
                            </>
                          ) : (
                            <span className="col-span-2 truncate">{bible.name}</span>
                          )}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              onClick={() => {
                onLivePresentation(0)
              }}
            >
              Presentar en vivo <Radio className="h-4 w-4" />
            </Button>
          </div>
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
