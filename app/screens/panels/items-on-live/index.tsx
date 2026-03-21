import { useSchedule } from '@/contexts/ScheduleContext'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, List, Radio } from 'lucide-react'
import { RenderSongLyrics } from './components/RenderSongLyrics'
import RenderBibleLiveControls from './components/RenderBibleLiveControls'
import { RenderMedia } from './components/RenderMedia'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/ui/button'
import { ViewModeTypes } from './types'
import RenderGridMode from './components/RenderGridMode'
import { useLive } from '../../../contexts/ScheduleContext/utils/liveContext'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { resolveSlideVerse } from '@/lib/presentationVerseController'
import RenderPresentationLiveController from './components/RenderPresentationLiveController/index'

const LIVE_VIEW_MODE_KEY = 'items-on-live-view-mode'

function getInitialViewMode(): ViewModeTypes {
  const savedMode = localStorage.getItem(LIVE_VIEW_MODE_KEY)
  return savedMode === 'grid' ? 'grid' : 'list'
}

export default function LivePanel() {
  const { itemOnLive, getScheduleItemContentScreen } = useSchedule()
  const {
    liveContentVersion,
    itemIndex,
    setItemIndex,
    presentationVerseBySlideKey,
    setPresentationVerseBySlideKey,
    presentationBibleOverrideByKey
  } = useLive()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [viewMode, setViewMode] = useState<ViewModeTypes>(getInitialViewMode)

  useEffect(() => {
    localStorage.setItem(LIVE_VIEW_MODE_KEY, viewMode)
  }, [viewMode])

  const { data } = useQuery({
    queryKey: [
      'liveItemContent',
      itemOnLive?.accessData,
      liveContentVersion,
      presentationBibleOverrideByKey
    ],
    queryFn: () => {
      return getScheduleItemContentScreen(itemOnLive!, {
        presentationBibleOverrideByKey
      })
    },
    enabled: !!itemOnLive
  })

  const slideCount = useMemo(() => {
    if (!Array.isArray(data?.content)) return 0
    return data.content.length
  }, [data?.content])

  useKeyboardShortcuts(containerRef, {
    onNavigate: (direction) => {
      if (!itemOnLive || slideCount <= 0) return

      const isBackward = direction === 'left' || direction === 'up' || direction === 'PageUp'
      const isForward = direction === 'right' || direction === 'down' || direction === 'PageDown'
      if (!isBackward && !isForward) return

      if (itemOnLive.type === 'PRESENTATION' && Array.isArray(data?.content)) {
        const safeIndex = Math.max(0, Math.min(itemIndex, slideCount - 1))
        const activeSlide = data.content[safeIndex]
        const verseController = resolveSlideVerse(
          activeSlide,
          safeIndex,
          presentationVerseBySlideKey
        )

        if (verseController) {
          if (isForward && verseController.current < verseController.end) {
            setPresentationVerseBySlideKey((previous) => ({
              ...previous,
              [verseController.slideKey]: verseController.current + 1
            }))
            return
          }

          if (isBackward && verseController.current > verseController.start) {
            setPresentationVerseBySlideKey((previous) => ({
              ...previous,
              [verseController.slideKey]: verseController.current - 1
            }))
            return
          }
        }
      }

      if (isBackward) {
        setItemIndex(Math.max(0, itemIndex - 1))
        return
      }

      if (isForward) {
        setItemIndex(Math.min(slideCount - 1, itemIndex + 1))
      }
    }
  })

  const renderContent = () => {
    const content = data!.content
    if (
      viewMode === 'grid' &&
      itemOnLive!.type !== 'MEDIA' &&
      itemOnLive!.type !== 'PRESENTATION'
    ) {
      return <RenderGridMode data={content} />
    }
    switch (itemOnLive!.type) {
      case 'SONG':
        return <RenderSongLyrics />
      case 'BIBLE':
        return <RenderBibleLiveControls data={content} />
      case 'MEDIA':
        return <RenderMedia />
      case 'PRESENTATION':
        return <RenderPresentationLiveController data={content} />
      default:
        return <div className="p-4 text-sm text-muted-foreground">Vista previa no disponible.</div>
    }
  }

  return (
    <div
      ref={containerRef}
      className="h-full min-w-1/3 flex flex-col min-h-0 overflow-hidden"
      onMouseDown={() => containerRef.current?.focus()}
    >
      <div className="shrink-0">
        <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2 text-sm">
          <div className="text-muted-foreground italic">
            <span>
              {itemOnLive ? (
                <>
                  {itemOnLive.type === 'SONG'
                    ? 'Canción'
                    : itemOnLive.type === 'BIBLE'
                      ? 'Biblia'
                      : itemOnLive.type === 'MEDIA'
                        ? 'Multimedia'
                        : itemOnLive.type === 'PRESENTATION'
                          ? 'Presentación'
                          : 'Otro contenido'}
                </>
              ) : (
                'Ningún elemento en vivo'
              )}{' '}
              {data?.title ? `- ${data.title}` : ''}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              className={`rounded-md p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary`}
              aria-label="Vista de lista"
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
            >
              <List className="h-5 w-5" />
            </Button>
            <Button
              className={`rounded-md p-1.5 transition-colors  focus:outline-none focus:ring-2 focus:ring-primary`}
              aria-label="Vista de cuadrícula"
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-5 w-5" />
            </Button>
            {itemOnLive ? (
              <div className="text-nowrap animate-pulse text-sm bg-green-600 text-white rounded-md px-2 py-1 flex items-center gap-1 ml-2">
                <Radio className="size-6" /> En vivo
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{data?.content ? renderContent() : null}</div>
    </div>
  )
}
