import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { PresentationView } from '@/ui/PresentationView'
import { PresentationViewItems, ThemeWithMedia } from '@/ui/PresentationView/types'

type Props = {
  data: PresentationViewItems[]
  themeOverride?: ThemeWithMedia
  indexMap?: number[]
  activeIndexOverride?: number
  onSelectIndexOverride?: (nextIndex: number) => void
  previewBadgeByIndex?: Array<string | null>
  presentationVerseBySlideKey?: Record<string, number>
}

export default function RenderGridMode({
  data,
  themeOverride,
  indexMap,
  activeIndexOverride,
  onSelectIndexOverride,
  previewBadgeByIndex,
  presentationVerseBySlideKey
}: Props) {
  const { selectedTheme } = useSchedule()
  const { itemIndex, setItemIndex } = useLive()
  const themeToUse = themeOverride || selectedTheme
  const activeIndex = activeIndexOverride ?? itemIndex

  return (
    <div className="flex gap-3 items-center flex-wrap p-4">
      {data.map((item, i) => (
        <div key={i} className="relative w-full sm:w-64 sm:max-w-64 shrink-0">
          <PresentationView
            selected={i === activeIndex}
            onClick={() => {
              const mappedIndex = indexMap?.[i] ?? i
              if (onSelectIndexOverride) {
                onSelectIndexOverride(mappedIndex)
                return
              }
              setItemIndex(mappedIndex)
            }}
            className="w-full"
            items={[item]}
            theme={themeToUse}
            presentationVerseBySlideKey={presentationVerseBySlideKey}
          />
          {previewBadgeByIndex?.[i] ? (
            <div className="pointer-events-none absolute right-1.5 top-1.5 rounded-sm border border-border/60 bg-background/85 px-1.5 py-0.5 text-[10px] font-medium leading-none text-foreground">
              {previewBadgeByIndex[i]}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
