import { ThemeWithMedia } from '@/components/PresentationView/types'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'

type IScheduleContext = {
  selectedTheme: ThemeWithMedia
  setSelectedTheme: (theme: ThemeWithMedia) => void
}

const ScheduleContext = createContext({} as IScheduleContext)

export const ScheduleProvider = ({ children }: PropsWithChildren) => {
  const { themes } = useThemes()
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithMedia>(BlankTheme)

  useEffect(() => {
    if (themes.length > 0 && selectedTheme.name === 'Blank') {
      setSelectedTheme(themes[0])
    }
  }, [themes])
  return (
    <ScheduleContext.Provider value={{ selectedTheme, setSelectedTheme }}>
      {children}
    </ScheduleContext.Provider>
  )
}

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext)
  return ctx
}
