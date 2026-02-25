import { useEffect, useState } from 'react'
import { ThemeWithMedia } from '../../ui/PresentationView/types'
import { BlankTheme } from '@/hooks/useThemes'
import { ContentScreen } from '@/contexts/ScheduleContext/types'
import { PresentationView } from '../../ui/PresentationView'
import { useParams } from 'react-router'
import { ScreenContentUpdate } from 'electron/main/displayManager/displayType'

export default function LiveScreen({ isPreview = false }: { isPreview?: boolean }) {
  const displayId = useParams().displayId
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithMedia>(BlankTheme)
  const [itemIndex, setItemIndex] = useState(0)
  const [content, setContent] = useState<ContentScreen | null>(null)
  const [themeKey, setThemeKey] = useState(0)

  useEffect(() => {
    console.log('LiveScreen mounted, setting up IPC listeners')
    const unsuscribeItems = window.electron.ipcRenderer.on(
      'liveScreen-update',
      (_, data: ScreenContentUpdate) => {
        console.log('Received live screen update:', data)
        setItemIndex(data.itemIndex)
        setContent(data.contentScreen)
      }
    )
    const unsuscribeThemes = window.electron.ipcRenderer.on(
      'liveScreen-update-theme',
      (_, data: ThemeWithMedia) => {
        console.log('Received live screen theme update:', data)
        setSelectedTheme(data)
        setThemeKey((prev) => prev + 1)
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
    <div className="overflow-hidden w-full">
      <PresentationView
        key={themeKey}
        items={content?.content || []}
        theme={selectedTheme}
        currentIndex={itemIndex}
        live
        displayId={displayId && !isPreview ? parseInt(displayId) : undefined}
      />
    </div>
  )
}
