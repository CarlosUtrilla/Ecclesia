import { useEffect, useRef, useState } from 'react'
import { ThemeWithMedia } from '../../ui/PresentationView/types'
import { BlankTheme } from '@/hooks/useThemes'
import { ContentScreen } from '@/contexts/ScheduleContext/types'
import { PresentationView } from '../../ui/PresentationView'
import { useParams } from 'react-router'
import { ScreenContentUpdate } from 'electron/main/displayManager/displayType'

const getThemeTransitionSignature = (theme: ThemeWithMedia): string => {
  const backgroundMedia = theme.backgroundMedia

  return [
    theme.id ?? 'no-theme-id',
    theme.background ?? 'no-background',
    backgroundMedia?.type ?? 'no-media-type',
    backgroundMedia?.filePath ?? 'no-media-file',
    backgroundMedia?.thumbnail ?? 'no-thumbnail',
    backgroundMedia?.fallback ?? 'no-fallback'
  ].join('|')
}

export default function LiveScreen({ isPreview = false }: { isPreview?: boolean }) {
  const displayId = useParams().displayId
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithMedia>(BlankTheme)
  const [itemIndex, setItemIndex] = useState(0)
  const [content, setContent] = useState<ContentScreen | null>(null)
  const [presentationVerseBySlideKey, setPresentationVerseBySlideKey] = useState<
    Record<string, number>
  >({})
  const [themeKey, setThemeKey] = useState(0)
  const lastThemeTransitionSignatureRef = useRef(getThemeTransitionSignature(BlankTheme))

  useEffect(() => {
    console.log('LiveScreen mounted, setting up IPC listeners')
    const unsuscribeItems = window.electron.ipcRenderer.on(
      'liveScreen-update',
      (_, data: ScreenContentUpdate) => {
        console.log('Received live screen update:', data)
        setItemIndex(data.itemIndex)
        setContent(data.contentScreen)
        setPresentationVerseBySlideKey(data.presentationVerseBySlideKey || {})
      }
    )
    const unsuscribeThemes = window.electron.ipcRenderer.on(
      'liveScreen-update-theme',
      (_, data: ThemeWithMedia) => {
        console.log('Received live screen theme update:', data)
        setSelectedTheme(data)

        const nextSignature = getThemeTransitionSignature(data)
        if (lastThemeTransitionSignatureRef.current !== nextSignature) {
          lastThemeTransitionSignatureRef.current = nextSignature
          setThemeKey((prev) => prev + 1)
        }
      }
    )
    const handleKeyUp = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        await window.displayAPI.handleHideLiveScreen()
      }
    }
    addEventListener('keyup', handleKeyUp)
    return () => {
      unsuscribeItems()
      unsuscribeThemes()
      removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <div className="overflow-hidden bg-black w-full h-full">
      <PresentationView
        items={content?.content || []}
        theme={selectedTheme}
        currentIndex={itemIndex}
        themeTransitionKey={themeKey}
        presentationVerseBySlideKey={presentationVerseBySlideKey}
        live
        displayId={displayId && !isPreview ? parseInt(displayId) : undefined}
      />
    </div>
  )
}
