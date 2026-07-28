import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback
} from 'react'
import { useForm } from 'react-hook-form'
import { ScheduleSchema } from './schema'

import type { ScheduleItem } from '@ecclesia/api'
import { useIndexDataItems } from './utils/indexDataItems'
import { LiveProvider } from './utils/liveContext'
import { AddItemToSchedule, IScheduleContext } from './types'
import DragAndDropSchedule from './utils/dragAndDropSchedule'
import { generateUniqueId } from '@/lib/utils'
import { Api, onSocketReconnect } from '@ecclesia/queries'

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
  const [socketReconnectKey, setSocketReconnectKey] = useState(0)
  const [isTemporary, setIsTemporary] = useState(true)

  // Re-registrar listeners Socket.IO cuando la conexión se reconecta
  useEffect(() => {
    return onSocketReconnect(() => setSocketReconnectKey((k) => k + 1))
  }, [])

  // Recibir scheduleStateUpdate desde otros clientes
  useEffect(() => {
    const unsub = Api.socket.listen.scheduleStateUpdate((payload) => {
      const data = {
        id: payload.id,
        title: payload.title,
        dateFrom: payload.dateFrom ? new Date(payload.dateFrom) : null,
        dateTo: payload.dateTo ? new Date(payload.dateTo) : null,
        items: payload.items.map((item) => ({
          ...item,
          scheduleId: item.scheduleId ?? -1,
          updatedAt: new Date(item.updatedAt),
          deletedAt: item.deletedAt ? new Date(item.deletedAt) : null
        }))
      }
      form.reset(data)
      setIsTemporary(payload.isTemporary)
    })

    const unsubRequest = Api.socket.listen.requestScheduleState(() => {
      Api.socket.emit.scheduleStateUpdate(serializeRef.current())
    })

    return () => {
      unsub()
      unsubRequest()
    }
  }, [socketReconnectKey])

  // Solicitar estado del schedule al host cuando se conecta/reconecta
  useEffect(() => {
    Api.socket.emit.requestScheduleState()
  }, [socketReconnectKey])

  // Helper: serializar estado del form para broadcast
  const serializeScheduleState = useCallback(() => {
    const values = form.getValues()
    return {
      id: values.id,
      title: values.title,
      dateFrom: values.dateFrom instanceof Date ? values.dateFrom.toISOString() : null,
      dateTo: values.dateTo instanceof Date ? values.dateTo.toISOString() : null,
      items: values.items.map((item) => ({
        id: item.id,
        order: item.order,
        type: item.type,
        accessData: item.accessData,
        scheduleId: item.scheduleId,
        updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt),
        deletedAt: item.deletedAt instanceof Date ? item.deletedAt.toISOString() : null
      })),
      isTemporary
    }
  }, [isTemporary, form])

  const formData = form.watch()

  const { getScheduleItemIcon, getScheduleItemLabel, getScheduleItemContentScreen, songs, media, presentations } =
    useIndexDataItems(formData)

  useEffect(() => {
    if (themes.length > 0 && selectedTheme.name === 'Blank') {
      setSelectedTheme(themes[0])
    }
  }, [themes])

  useEffect(() => {
    if (selectedTheme.name === 'Blank') {
      return
    }

    const updatedSelectedTheme = themes.find((theme) => theme.id === selectedTheme.id)
    if (!updatedSelectedTheme) {
      return
    }

    if (
      String(updatedSelectedTheme.updatedAt) !== String(selectedTheme.updatedAt) ||
      updatedSelectedTheme.textStyle !== selectedTheme.textStyle ||
      updatedSelectedTheme.animationSettings !== selectedTheme.animationSettings ||
      updatedSelectedTheme.transitionSettings !== selectedTheme.transitionSettings ||
      updatedSelectedTheme.background !== selectedTheme.background ||
      updatedSelectedTheme.backgroundMediaId !== selectedTheme.backgroundMediaId
    ) {
      setSelectedTheme(updatedSelectedTheme)
    }
  }, [themes, selectedTheme])

  const serializeRef = useRef(serializeScheduleState)
  serializeRef.current = serializeScheduleState

  useEffect(() => {
    const actualSchedule = async () => {
      const schedule = await Api.fetch.schedule.getActualSchedule()
      if (schedule) {
        form.reset(schedule)
        setIsTemporary(false)
        Api.socket.emit.scheduleStateUpdate({
          ...serializeRef.current(),
          isTemporary: false
        })
      }
    }
    actualSchedule()
  }, [])

  const addItemToSchedule = useCallback(
    (item: AddItemToSchedule) => {
      if (
        !item.type ||
        !['BIBLE', 'SONG', 'MEDIA', 'PRESENTATION', 'GROUP', 'TIMER'].includes(item.type)
      ) {
        return
      }

      const newItem: ScheduleItem = {
        id: generateUniqueId(),
        order: 0, // Se recalcula abajo
        type: item.type,
        accessData: String(item.accessData),
        scheduleId: formData.id || -1,
        updatedAt: new Date(),
        deletedAt: null
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
      Api.socket.emit.scheduleStateUpdate(serializeScheduleState())
    },
    [formData.items, formData.id, form, serializeScheduleState]
  )

  const updateItemAccessData = useCallback(
    (itemId: string, accessData: string) => {
      const updatedItems = formData.items.map((it) =>
        it.id === itemId ? { ...it, accessData, updatedAt: new Date() } : it
      )
      form.setValue('items', updatedItems, { shouldDirty: true })
      Api.socket.emit.scheduleStateUpdate(serializeScheduleState())
    },
    [formData.items, form, serializeScheduleState]
  )

  const deleteItemFromSchedule = useCallback(
    (index: number) => {
      const updatedItems = [...formData.items]
      updatedItems.splice(index, 1)
      // Recalcular order para todos los items
      const reOrdered = updatedItems.map((it, idx) => ({ ...it, order: idx + 1 }))
      form.setValue('items', reOrdered, { shouldDirty: true })
      Api.socket.emit.scheduleStateUpdate(serializeScheduleState())
    },
    [formData.items, form, serializeScheduleState]
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
    Api.socket.emit.scheduleStateUpdate(serializeScheduleState())
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
        const items = (scheduleData.items || []).map(({ order, type, accessData, deletedAt }) => ({
          order,
          type,
          accessData,
          deletedAt: deletedAt ?? null
        }))
        await Api.fetch.schedule.updateSchedule({
          body: {
            id: scheduleData.id,
            data: {
              title: scheduleData.title,
              dateFrom: scheduleData.dateFrom || undefined,
              dateTo: scheduleData.dateTo || undefined,
              items
            }
          }
        })
      } else {
        // Crear nuevo schedule con items
        const items = (scheduleData.items || []).map(({ order, type, accessData, deletedAt }) => ({
          order,
          type,
          accessData,
          deletedAt: deletedAt ?? null
        }))
        const created = await Api.fetch.schedule.createSchedule({
          body: {
            name: scheduleData.title,
            dateFrom: scheduleData.dateFrom || undefined,
            dateTo: scheduleData.dateTo || undefined,
            items
          }
        })
        // Asignar el id al form
        form.setValue('id', created.id)
      }
      // Reset dirty state
      const saved = form.getValues()
      form.reset(saved)
      Api.socket.emit.scheduleStateUpdate(serializeScheduleState())
    } catch (error) {
      console.error('Error saving schedule changes:', error)
    }
  }

  const itemsSortableIndex = currentSchedule.map((i) => i.id)

  // Método para cargar un schedule desde la base de datos
  const loadSchedule = async (scheduleId: number) => {
    const schedule = await Api.fetch.schedule.getSchedule({ body: { id: scheduleId } })
    if (schedule) {
      form.reset(schedule)
      setItemOnLive(null)
      Api.socket.emit.scheduleStateUpdate(serializeScheduleState())
    }
  }

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
    Api.socket.emit.scheduleStateUpdate(serializeScheduleState())
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
    Api.socket.emit.scheduleStateUpdate(serializeScheduleState())
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
        presentations,
        addItemToSchedule,
        updateItemAccessData,
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
