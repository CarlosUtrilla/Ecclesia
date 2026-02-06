import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { zodResolver } from '@hookform/resolvers/zod'
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ScheduleSchema } from './schema'

import { ScheduleGroup, ScheduleItem } from '@prisma/client'
import { useIndexDataItems } from './utils/indexDataItems'
import { LiveProvider } from './utils/liveContext'
import { AddItemToSchedule, IScheduleContext, ScheduleItemData } from './types'
import DragAndDropSchedule from './utils/dragAndDropSchedule'
import { generateUniqueId } from '@/lib/utils'
import { ScheduleGroupTemplateDTO } from 'database/controllers/schedule/schedule.dto'

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

  const formData = form.watch()

  const { getScheduleItemIcon, getScheduleItemLabel, getScheduleItemContentScreen, songs, media } =
    useIndexDataItems(formData)
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

  const addItemToSchedule = (item: AddItemToSchedule, groupId?: string) => {
    if (!item.type || !['BIBLE', 'SONG', 'MEDIA', 'PRESENTATION'].includes(item.type)) return
    // Determinar el tipo y crear el item apropiado
    const newItem: ScheduleItem = {
      id: generateUniqueId(),
      order: (formData?.items.length || 0) + 1,
      type: item.type,
      accessData: String(item.accessData),
      scheduleGroupId: groupId || null,
      scheduleId: formData.id || -1
    }

    form.setValue('items', [...formData.items, newItem], { shouldDirty: true })
  }

  const deleteItemFromSchedule = (index: number) => {
    const updatedItems = [...formData.items]
    updatedItems.splice(index, 1)
    form.setValue('items', updatedItems, { shouldDirty: true })
  }

  const currentSchedule = useMemo(() => {
    const { groups, items } = formData
    const ungrupedItems = items
      .filter((i) => i.scheduleGroupId === null)
      .map<ScheduleItemData>((i) => ({
        group: null,
        items: [i],
        order: i.order
      }))
    const groupsWithItems = groups.map<ScheduleItemData>((g) => ({
      group: g,
      items: items.filter((i) => i.scheduleGroupId === g.id).sort((a, b) => a.order - b.order),
      order: g.order
    }))
    return [...ungrupedItems, ...groupsWithItems].sort((a, b) => a.order - b.order)
  }, [formData])

  const addGroupToSchedule = (template: ScheduleGroupTemplateDTO) => {
    const newGroup: ScheduleGroup = {
      id: generateUniqueId(),
      name: template.name,
      color: template.color,
      order: (formData?.groups.length || 0) + 1,
      groupTemplateId: template.id,
      scheduleId: formData.id || null
    }
    form.setValue('groups', [...formData.groups, newGroup], { shouldDirty: true })
  }

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
        media,
        addItemToSchedule,
        deleteItemFromSchedule,
        addGroupToSchedule
      }}
    >
      <LiveProvider>
        <DragAndDropSchedule>{children}</DragAndDropSchedule>
      </LiveProvider>
    </ScheduleContext.Provider>
  )
}

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext)
  return ctx
}
