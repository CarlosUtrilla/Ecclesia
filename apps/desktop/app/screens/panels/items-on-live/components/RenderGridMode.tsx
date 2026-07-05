import { useCallback, useRef } from 'react'
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
  const { itemIndex, setItemIndex, appliedTheme } = useLive()
  const themeToUse = themeOverride || appliedTheme
  const activeIndex = activeIndexOverride ?? itemIndex

  const indexMapRef = useRef(indexMap)
  indexMapRef.current = indexMap
  const onSelectRef = useRef(onSelectIndexOverride)
  onSelectRef.current = onSelectIndexOverride
  const setItemIndexRef = useRef(setItemIndex)
  setItemIndexRef.current = setItemIndex

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const index = Number(e.currentTarget.dataset.gridIndex)
    const mappedIndex = indexMapRef.current?.[index] ?? index
    if (onSelectRef.current) {
      onSelectRef.current(mappedIndex)
      return
    }
    setItemIndexRef.current(mappedIndex)
  }, [])

  return (
    <div className="flex gap-3 items-center flex-wrap p-4">
      {data.map((item, i) => (
        <div
          key={i}
          data-grid-index={i}
          onClick={handleClick}
          className="relative w-full sm:w-64 sm:max-w-64 shrink-0 cursor-pointer"
        >
          <PresentationView
            selected={i === activeIndex}
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
