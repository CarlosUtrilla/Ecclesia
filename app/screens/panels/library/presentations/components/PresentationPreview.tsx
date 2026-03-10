import { Edit2 } from 'lucide-react'
import type { Media } from '@prisma/client'
import { Button } from '@/ui/button'
import { BlankTheme } from '@/hooks/useThemes'
import { useThemes } from '@/hooks/useThemes'
import { PresentationView } from '@/ui/PresentationView'
import { presentationSlideToViewItem } from '@/lib/presentationSlides'
import { useMemo } from 'react'

type Props = {
  presentation: {
    id: number
    title: string
    slides: any[]
  }
  presentationMediaById: Map<number, Media>
}

export default function PresentationPreview({ presentation, presentationMediaById }: Props) {
  const { themes } = useThemes()
  const themeById = useMemo(() => new Map(themes.map((theme) => [theme.id, theme])), [themes])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
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
      <div className="flex items-center flex-wrap gap-2">
        {presentation.slides.slice(0, 8).map((slide) => (
          <PresentationView
            key={slide.id}
            items={[presentationSlideToViewItem(slide, presentationMediaById, themeById)]}
            theme={BlankTheme}
            className="max-w-40"
          />
        ))}
      </div>
    </div>
  )
}
