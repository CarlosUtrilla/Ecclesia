import { useEffect, useState } from 'react'
import { ThemeWithMedia } from '../PresentationView/types'
import { BlankTheme } from '@/hooks/useThemes'
import { ContentScreen } from '@/contexts/ScheduleContext/types'
import { PresentationView } from '../PresentationView'
import { useParams } from 'react-router'
import { ScreenContentUpdate } from 'electron/main/displayManager/displayType'

export default function LiveScreen() {
  const displayId = useParams().displayId
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithMedia>(BlankTheme)
  const [itemIndex, setItemIndex] = useState(0)
  const [content, setContent] = useState<ContentScreen | null>(null)
  const [themeKey, setThemeKey] = useState(0)
  useEffect(() => {
    const unsuscribeItems = window.electron.ipcRenderer.on(
      'liveScreen-update',
      (_, data: ScreenContentUpdate) => {
        setItemIndex(data.itemIndex)
        setContent(data.contentScreen)
      }
    )
    const unsuscribeThemes = window.electron.ipcRenderer.on(
      'liveScreen-update-theme',
      (_, data: ThemeWithMedia) => {
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
    <div className="overflow-hidden">
      <PresentationView
        key={themeKey}
        items={content?.content || []}
        theme={selectedTheme}
        currentIndex={itemIndex}
        live
        displayId={displayId ? parseInt(displayId) : undefined}
      />
    </div>
  )
}
