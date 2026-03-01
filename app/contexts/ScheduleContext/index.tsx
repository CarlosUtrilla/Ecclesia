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
        order: 0, // Se recalcula abajo
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

      // Recalcular order para todos los items
      const reOrdered = updatedItems.map((it, idx) => ({ ...it, order: idx + 1 }))
      form.setValue('items', reOrdered, { shouldDirty: true })
    },
    [formData.items, formData.id, form]
  )

  const deleteItemFromSchedule = useCallback(
    (index: number) => {
      const updatedItems = [...formData.items]
      updatedItems.splice(index, 1)
      // Recalcular order para todos los items
      const reOrdered = updatedItems.map((it, idx) => ({ ...it, order: idx + 1 }))
      form.setValue('items', reOrdered, { shouldDirty: true })
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
    if (activeIndex === -1 || overIndex === -1) return
    const reordered = [...formData.items]
    const [moved] = reordered.splice(activeIndex, 1)
    reordered.splice(overIndex, 0, moved)
    // Recalcular order para todos los items
    const reOrdered = reordered.map((item, idx) => ({ ...item, order: idx + 1 }))
    form.setValue('items', reOrdered, { shouldDirty: true })
  }

  // Alias para compatibilidad con DnD
  const reorderInMainSchedule = reorderItems

  // Función para persistir cambios en la base de datos
  const saveScheduleChanges = async () => {
    try {
      const scheduleData = form.getValues()
      if (!scheduleData.title || scheduleData.title.trim() === '') {
        form.setError('title', {
          type: 'manual',
          message: 'Debes ingresar un nombre para el cronograma.'
        })
        return
      }
      if (scheduleData.id) {
        // Actualizar schedule existente (incluyendo items)
        // Filtrar campos válidos para items
        const items = (scheduleData.items || []).map(({ id, order, type, accessData }) => ({
          id,
          order,
          type,
          accessData
        }))
        await window.api.schedule.updateSchedule(scheduleData.id, {
          title: scheduleData.title,
          dateFrom: scheduleData.dateFrom || undefined,
          dateTo: scheduleData.dateTo || undefined,
          items
        })
      } else {
        // Crear nuevo schedule con items
        const created = await window.api.schedule.createSchedule(
          scheduleData.title,
          scheduleData.dateFrom || undefined,
          scheduleData.dateTo || undefined,
          scheduleData.items || []
        )
        // Asignar el id al form
        form.setValue('id', created.id)
      }
      // Reset dirty state
      form.reset(form.getValues())
    } catch (error) {
      console.error('Error saving schedule changes:', error)
    }
  }

  const itemsSortableIndex = currentSchedule.map((i) => i.id)

  // Método para cargar un schedule desde la base de datos
  const loadSchedule = async (scheduleId: number) => {
    const schedule = await window.api.schedule.getSchedule(scheduleId)
    if (schedule) {
      form.reset(schedule)
      setItemOnLive(null)
    }
  }

  // Estado y función para sesión temporal
  const [isTemporary, setIsTemporary] = useState(true)
  const createTemporarySchedule = () => {
    form.reset({
      id: null,
      title: '',
      items: [],
      dateFrom: null,
      dateTo: null
    })
    setItemOnLive(null)
    setIsTemporary(true)
  }

  const cleanForm = () => {
    form.reset({
      id: null,
      title: '',
      items: [],
      dateFrom: null,
      dateTo: null
    })
    setIsTemporary(false)
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
        reorderItems,
        reorderInMainSchedule,
        saveScheduleChanges,
        itemsSortableIndex,
        loadSchedule,
        createTemporarySchedule,
        isTemporary,
        formData,
        cleanForm
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
