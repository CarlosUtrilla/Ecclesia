import { ThemeWithMedia } from '@/components/PresentationView/types'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { zodResolver } from '@hookform/resolvers/zod'
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'
import { useForm, UseFormReturn } from 'react-hook-form'
import { ScheduleSchema, ScheduleSchemaType } from './schema'

import { Media, ScheduleItem } from '@prisma/client'
import { ContentScreen, useIndexDataItems } from './indexDataItems'
import { SongResponseDTO } from 'database/controllers/songs/songs.dto'

type IScheduleContext = {
  itemOnLive: ScheduleItem | null
  setItemOnLive: (item: ScheduleItem | null) => void
  selectedTheme: ThemeWithMedia
  setSelectedTheme: (theme: ThemeWithMedia) => void
  currentSchedule: ScheduleSchemaType | null
  form: UseFormReturn<ScheduleSchemaType>
  getScheduleItemIcon: (item: ScheduleItem) => React.ReactNode
  getScheduleItemLabel: (item: ScheduleItem) => React.ReactNode
  getScheduleItemContentScreen: (item: ScheduleItem) => Promise<ContentScreen>
  songs: SongResponseDTO[]
  media: Media[]
}

const ScheduleContext = createContext({} as IScheduleContext)

export const ScheduleProvider = ({ children }: PropsWithChildren) => {
  const { themes } = useThemes()
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithMedia>(BlankTheme)
  const [itemOnLive, setItemOnLive] = useState<ScheduleItem | null>(null)
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

  const { getScheduleItemIcon, getScheduleItemLabel, getScheduleItemContentScreen, songs, media } =
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

  console.log(itemOnLive)

  return (
    <ScheduleContext.Provider
      value={{
        itemOnLive,
        setItemOnLive,
        selectedTheme,
        setSelectedTheme,
        currentSchedule,
        form,
        getScheduleItemIcon,
        getScheduleItemLabel,
        getScheduleItemContentScreen,
        songs,
        media
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
