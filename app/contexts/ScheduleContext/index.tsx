import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback
} from 'react'
import { useForm } from 'react-hook-form'
import { ScheduleSchema } from './schema'

import { ScheduleItem } from '@prisma/client'
import { useIndexDataItems } from './utils/indexDataItems'
import { LiveProvider } from './utils/liveContext'
import { AddItemToSchedule, IScheduleContext } from './types'
import DragAndDropSchedule from './utils/dragAndDropSchedule'
import { generateUniqueId } from '@/lib/utils'

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

  const addItemToSchedule = useCallback(
    (item: AddItemToSchedule) => {
      if (!item.type || !['BIBLE', 'SONG', 'MEDIA', 'PRESENTATION', 'GROUP'].includes(item.type)) {
        return
      }

      const newItem: ScheduleItem = {
        id: generateUniqueId(),
        order: item.insertPosition ?? (formData.items.length || 0) + 1,
        type: item.type,
        accessData: String(item.accessData),
        scheduleId: formData.id || -1
      }

      const updatedItems = [...formData.items]

      if (typeof item.insertPosition === 'number') {
        updatedItems.splice(item.insertPosition, 0, newItem)
      } else {
        updatedItems.push(newItem)
      }

      form.setValue('items', updatedItems, { shouldDirty: true })
    },
    [formData.items, formData.id, form]
  )

  const deleteItemFromSchedule = useCallback(
    (index: number) => {
      const updatedItems = [...formData.items]
      updatedItems.splice(index, 1)
      form.setValue('items', updatedItems, { shouldDirty: true })
    },
    [formData.items, form]
  )

  const currentSchedule = useMemo(() => {
    return formData.items.sort((a, b) => a.order - b.order)
  }, [formData.items])

  // Reordenar items en la lista plana (incluyendo grupos como items)
  const reorderItems = (activeId: string, overId: string) => {
    const activeIndex = formData.items.findIndex((item) => item.id === activeId)
    const overIndex = formData.items.findIndex((item) => item.id === overId)
    console.log('reordenando', activeIndex, overIndex, formData)
    if (activeIndex === -1 || overIndex === -1) return
    const reordered = [...formData.items]
    const [moved] = reordered.splice(activeIndex, 1)
    reordered.splice(overIndex, 0, moved)
    // Actualizar los orders
    const updated = reordered.map((item, idx) => ({ ...item, order: idx + 1 }))
    form.setValue('items', updated, { shouldDirty: true })
  }

  // Alias para compatibilidad con DnD
  const reorderInMainSchedule = reorderItems

  // Función para persistir cambios en la base de datos
  const saveScheduleChanges = async () => {
    try {
      const scheduleData = form.getValues()
      if (scheduleData.id) {
        // TODO: Implementar updateSchedule cuando esté disponible en la API
        console.log('Saving schedule changes:', scheduleData)
      } else {
        // TODO: Implementar createSchedule cuando esté disponible en la API
        console.log('Creating new schedule:', scheduleData)
      }
      // Reset dirty state
      // form.reset(scheduleData)
    } catch (error) {
      console.error('Error saving schedule changes:', error)
    }
  }

  const itemsSortableIndex = currentSchedule.map((i) => i.id)

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
        reorderItems,
        reorderInMainSchedule,
        saveScheduleChanges,
        itemsSortableIndex
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
