import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { zodResolver } from '@hookform/resolvers/zod'
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ScheduleSchema } from './schema'

import { ScheduleItem } from '@prisma/client'
import { useIndexDataItems } from './utils/indexDataItems'
import { LiveProvider } from './utils/liveContext'
import { AddItemToSchedule, IScheduleContext } from './types'
import { DndContext, DragOverlay, DragStartEvent } from '@dnd-kit/core'
import ScheduleItemComponent from '@/screens/panels/schedule/scheduleContent/scheduleItem'

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
      dateTo: null,
      groups: []
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

  const addItemToSchedule = (item: AddItemToSchedule) => {
    // Determinar el tipo y crear el item apropiado
    const newItem: any = {
      order: (currentSchedule?.items.length || 0) + 1,
      scheduleGroupId: null
    }

    if (item.type === 'SONG') {
      newItem.type = 'SONG'
      newItem.accessData = String(item.accessData)
    } else if (item.type === 'MEDIA') {
      newItem.type = 'MEDIA'
      newItem.accessData = String(item.accessData)
    } else if (item.type === 'BIBLE') {
      // Formato: "bookId,chapter,verseStart-verseEnd,version"
      newItem.type = 'BIBLE'
      newItem.accessData = item.accessData
    } else {
      console.warn('Tipo de item desconocido:', item.type)
      return
    }

    form.setValue('items', [...currentSchedule.items, newItem], { shouldDirty: true })
  }

  const [draggingItem, setDraggingItem] = useState<ScheduleItem | null>(null)

  const handleOnDragStart = (event: DragStartEvent) => {
    //Comprobamos si el item que se esta arrastrando es uno compatible con el schedule
    const current = event.active.data.current as AddItemToSchedule
    if (current.type !== undefined) {
      // convertimos el dato en item y lo seteamos como dragging item
      const item: ScheduleItem = {
        id: -1,
        type: current.type,
        accessData: String(current.accessData),
        order: (currentSchedule?.items.length || 0) + 1,
        scheduleGroupId: null,
        scheduleId: -1
      }
      setDraggingItem(item)
    }
  }

  return (
    <DndContext
      onDragStart={handleOnDragStart}
      onDragEnd={() => setDraggingItem(null)}
      onDragCancel={() => setDraggingItem(null)}
    >
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
          media,
          addItemToSchedule
        }}
      >
        <LiveProvider>{children}</LiveProvider>
        <DragOverlay>
          {draggingItem ? <ScheduleItemComponent item={draggingItem} /> : null}
        </DragOverlay>
      </ScheduleContext.Provider>
    </DndContext>
  )
}

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext)
  return ctx
}
