import { PresentationViewItems, ThemeWithMedia } from '@/components/PresentationView/types'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { zodResolver } from '@hookform/resolvers/zod'
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'
import { useForm, UseFormReturn } from 'react-hook-form'
import { ScheduleSchema, ScheduleSchemaType } from './schema'

import { ScheduleItem } from '@prisma/client'
import { useIndexDataItems } from './indexDataItems'

type IScheduleContext = {
  selectedTheme: ThemeWithMedia
  setSelectedTheme: (theme: ThemeWithMedia) => void
  currentSchedule: ScheduleSchemaType | null
  form: UseFormReturn<ScheduleSchemaType>
  getScheduleItemIcon: (item: ScheduleItem) => React.ReactNode
  getScheduleItemLabel: (item: ScheduleItem) => React.ReactNode
  getScheduleItemContentScreen: (item: ScheduleItem) => Promise<PresentationViewItems[]>
}

const ScheduleContext = createContext({} as IScheduleContext)

export const ScheduleProvider = ({ children }: PropsWithChildren) => {
  const { themes } = useThemes()
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithMedia>(BlankTheme)
  const form = useForm({
    defaultValues: {
      id: null,
      title: '',
      items: [],
      dateFrom: null,
      dateTo: null
    },
    resolver: zodResolver(ScheduleSchema)
  })

  const currentSchedule = form.watch()

  const { getScheduleItemIcon, getScheduleItemLabel, getScheduleItemContentScreen } =
    useIndexDataItems(currentSchedule)
  useEffect(() => {
    if (themes.length > 0 && selectedTheme.name === 'Blank') {
      setSelectedTheme(themes[0])
    }
  }, [themes])

  useEffect(() => {
    const actualSchedule = async () => {
      const schedule = await window.api.schedule.getActualSchedule()
      if (schedule) {
        form.reset(schedule)
      }
    }
    actualSchedule()
  }, [])

  return (
    <ScheduleContext.Provider
      value={{
        selectedTheme,
        setSelectedTheme,
        currentSchedule,
        form,
        getScheduleItemIcon,
        getScheduleItemLabel,
        getScheduleItemContentScreen
      }}
    >
      {children}
    </ScheduleContext.Provider>
  )
}

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext)
  return ctx
}
