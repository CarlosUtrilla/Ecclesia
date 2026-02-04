import { PresentationViewItems } from '@/ui/PresentationView/types'
import { useLive } from '@/contexts/ScheduleContext/liveContext'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { cn } from '@/lib/utils'
import { useRef } from 'react'

type Props = {
  data: PresentationViewItems[]
}

export default function RenderBibleVerses({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { itemIndex, setItemIndex } = useLive()

  useKeyboardShortcuts(containerRef, {
    onNavigate: (direction) => {
      let newIndex = itemIndex
      if (direction === 'up' || direction === 'left') {
        newIndex = Math.max(0, itemIndex - 1)
      } else if (direction === 'down' || direction === 'right') {
        newIndex = Math.min(data.length - 1, itemIndex + 1)
      }
      setItemIndex(newIndex)
    }
  })
  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      {data.map(({ text, verse }, i) => (
        <div
          className={cn('flex border-b items-baseline hover:bg-muted/40 cursor-pointer', {
            'bg-secondary/20 hover:bg-secondary/10': itemIndex === i
          })}
          key={i}
          onClick={() => setItemIndex(i)}
        >
          <div className="font-semibold text-muted-foreground w-7 text-center text-sm select-none">
            {verse?.verse}
          </div>
          <div className="flex-1 pr-1.5 text-sm select-none">{text}</div>
        </div>
      ))}
    </div>
  )
}
