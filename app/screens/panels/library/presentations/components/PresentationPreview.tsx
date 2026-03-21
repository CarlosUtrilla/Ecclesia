import { Edit2 } from 'lucide-react'
import type { Media } from '@prisma/client'
import { Button } from '@/ui/button'
import { BlankTheme } from '@/hooks/useThemes'
import { useThemes } from '@/hooks/useThemes'
import { PresentationView } from '@/ui/PresentationView'
import { presentationSlideToViewItem } from '@/lib/presentationSlides'
import { generateUniqueId } from '@/lib/utils'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { useMemo, useRef, useState } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

type Props = {
  presentation: {
    id: number
    title: string
    slides: any[]
  }
  presentationMediaById: Map<number, Media>
}

export default function PresentationPreview({ presentation, presentationMediaById }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { themes } = useThemes()
  const { showItemOnLiveScreen } = useLive()
  const themeById = useMemo(() => new Map(themes.map((theme) => [theme.id, theme])), [themes])
  const [selectedSlide, setSelectedSlide] = useState<number | null>(null)

  const handleShowSlideOnLive = (slideIndex: number) => {
    showItemOnLiveScreen(
      {
        id: generateUniqueId(),
        type: 'PRESENTATION',
        accessData: presentation.id.toString(),
        order: -1,
        scheduleId: -1,
        updatedAt: new Date(),
        deletedAt: null
      },
      slideIndex
    )
  }

  useKeyboardShortcuts(containerRef, {
    onEnter: () => {
      console.log('on entewr')
      if (selectedSlide !== null) {
        handleShowSlideOnLive(selectedSlide)
      }
    }
  })
  return (
    <div className="panel-scrollable h-full">
      <div className="panel-header flex items-center justify-between pb-3">
        <div>
          <h3 className="font-semibold">{presentation.title}</h3>
          <p className="text-xs text-muted-foreground">
            {presentation.slides.length} diapositiva
            {presentation.slides.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button onClick={() => window.windowAPI.openPresentationWindow(presentation.id)}>
          <Edit2 className="size-4" />
          Editar
        </Button>
      </div>
      <div
        ref={containerRef}
        className="panel-scroll-content flex flex-wrap items-start content-start gap-2 p-1"
      >
        {presentation.slides.map((slide, slideIndex) => (
          <PresentationView
            items={[presentationSlideToViewItem(slide, presentationMediaById, themeById)]}
            theme={BlankTheme}
            className="max-w-40 h-auto"
            selected={selectedSlide === slideIndex}
            onClick={() => setSelectedSlide(slideIndex)}
            onDoubleClick={() => handleShowSlideOnLive(slideIndex)}
            key={slideIndex}
          />
        ))}
      </div>
    </div>
  )
}
