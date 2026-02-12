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

  const addItemToSchedule = useCallback(
    (item: AddItemToSchedule, groupId?: string) => {
      if (!item.type || !['BIBLE', 'SONG', 'MEDIA', 'PRESENTATION'].includes(item.type)) {
        return
      }

      console.log('🟪 addItemToSchedule called:', {
        type: item.type,
        accessData: item.accessData,
        insertPosition: item.insertPosition,
        groupId,
        currentItemsCount: formData.items.length
      })

      const newItem: ScheduleItem = {
        id: generateUniqueId(),
        order: item.insertPosition ?? (formData.items.length || 0) + 1,
        type: item.type,
        accessData: String(item.accessData),
        scheduleGroupId: groupId || null,
        scheduleId: formData.id || -1
      }

      const updatedItems = [...formData.items]

      if (typeof item.insertPosition === 'number') {
        console.log('🟪 Inserting at specific position:', {
          position: item.insertPosition,
          beforeInsert: updatedItems.map((i, idx) => ({ idx, id: i.id, order: i.order }))
        })
        updatedItems.splice(item.insertPosition, 0, newItem)
        console.log('🟪 After insert:', {
          afterInsert: updatedItems.map((i, idx) => ({ idx, id: i.id, order: i.order }))
        })
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

    const result = [...ungrupedItems, ...groupsWithItems].sort((a, b) => a.order - b.order)
    return result
  }, [formData])

  const addGroupToSchedule = useCallback(
    (template: ScheduleGroupTemplateDTO) => {
      const newGroup: ScheduleGroup = {
        id: generateUniqueId(),
        name: template.name,
        color: template.color,
        order: (formData.groups.length || 0) + 1,
        groupTemplateId: template.id,
        scheduleId: formData.id || null
      }
      form.setValue('groups', [...formData.groups, newGroup], { shouldDirty: true })
    },
    [formData.groups, formData.id, form]
  )

  // Función para reordenar items DENTRO de grupos solamente
  const reorderItems = (activeId: string, overId: string) => {
    const activeItem = formData.items.find((item) => item.id === activeId)
    const overItem = formData.items.find((item) => item.id === overId)

    if (!activeItem || !overItem) {
      return
    }

    // SOLO proceder si ambos están DENTRO del mismo grupo (no items sin grupo)
    if (
      activeItem.scheduleGroupId === overItem.scheduleGroupId &&
      activeItem.scheduleGroupId !== null
    ) {
      const itemsInSameContext = formData.items
        .filter((item) => item.scheduleGroupId === activeItem.scheduleGroupId)
        .sort((a, b) => a.order - b.order)

      const activeIndex = itemsInSameContext.findIndex((item) => item.id === activeId)
      const overIndex = itemsInSameContext.findIndex((item) => item.id === overId)

      if (activeIndex === -1 || overIndex === -1) {
        return
      }

      // Crear nueva lista reordenada
      const reorderedItems = [...itemsInSameContext]
      const [movedItem] = reorderedItems.splice(activeIndex, 1)
      reorderedItems.splice(overIndex, 0, movedItem)

      // Actualizar orders
      const updatedItems = formData.items.map((item) => {
        if (item.scheduleGroupId !== activeItem.scheduleGroupId) return item
        const newOrderIndex = reorderedItems.findIndex(
          (reorderedItem) => reorderedItem.id === item.id
        )
        return { ...item, order: newOrderIndex }
      })

      form.setValue('items', updatedItems, { shouldDirty: true })
    } else {
      reorderInMainSchedule(activeId, overId)
    }
  }

  // Función unificada para reordenar en la lista principal (items sin grupo + grupos)
  const reorderInMainSchedule = (activeId: string, overId: string) => {
    // Extraer IDs reales removiendo prefijos
    const getItemId = (id: string) => id.replace(/^schedule-item-/, '')
    const getGroupId = (id: string) => id.replace(/^schedule-group-/, '')

    const activeItemId = activeId.startsWith('schedule-item-') ? getItemId(activeId) : null
    const activeGroupId = activeId.startsWith('schedule-group-') ? getGroupId(activeId) : null

    const overItemId = overId.startsWith('schedule-item-') ? getItemId(overId) : null
    const overGroupId = overId.startsWith('schedule-group-') ? getGroupId(overId) : null

    // Obtener el currentSchedule actual para trabajar con los índices visuales
    const scheduleArray = currentSchedule

    // Encontrar índices en el array visual
    const activeIndex = scheduleArray.findIndex((item) => {
      return item.group
        ? activeGroupId && item.group.id === activeGroupId
        : activeItemId && item.items[0]?.id === activeItemId
    })

    const overIndex = scheduleArray.findIndex((item) => {
      return item.group
        ? overGroupId && item.group.id === overGroupId
        : overItemId && item.items[0]?.id === overItemId
    })

    if (activeIndex === -1 || overIndex === -1) {
      return
    }

    // Reordenar el array visual
    const reorderedSchedule = [...scheduleArray]
    const [movedItem] = reorderedSchedule.splice(activeIndex, 1)
    reorderedSchedule.splice(overIndex, 0, movedItem)

    // Actualizar los orders basándose en el nuevo orden visual
    const updatedGroups = [...formData.groups]
    const updatedItems = [...formData.items]

    reorderedSchedule.forEach((scheduleItem, newOrder) => {
      if (scheduleItem.group) {
        // Es un grupo
        const groupIndex = updatedGroups.findIndex((g) => g.id === scheduleItem.group!.id)
        if (groupIndex !== -1) {
          updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], order: newOrder }
        }
      } else {
        // Es un item sin grupo
        const itemId = scheduleItem.items[0].id
        const itemIndex = updatedItems.findIndex((i) => i.id === itemId)
        if (itemIndex !== -1) {
          updatedItems[itemIndex] = { ...updatedItems[itemIndex], order: newOrder }
        }
      }
    })

    // Aplicar los cambios
    form.setValue('groups', updatedGroups, { shouldDirty: true })
    form.setValue('items', updatedItems, { shouldDirty: true })
  }

  // Función para reordenar grupos (mantener funcionalidad original)
  const reorderGroups = (activeId: string, overId: string) => {
    const activeIndex = formData.groups.findIndex((group) => group.id === activeId)
    const overIndex = formData.groups.findIndex((group) => group.id === overId)

    if (activeIndex === -1 || overIndex === -1) return

    const reorderedGroups = [...formData.groups]
    const [movedGroup] = reorderedGroups.splice(activeIndex, 1)
    reorderedGroups.splice(overIndex, 0, movedGroup)

    // Actualizar orders
    const updatedGroups = reorderedGroups.map((group, index) => ({
      ...group,
      order: index
    }))

    form.setValue('groups', updatedGroups, { shouldDirty: true })
  }

  // Función para mover item a grupo
  const moveItemToGroup = useCallback(
    (itemId: string, targetGroupId: string | null) => {
      const realItemId = itemId.replace(/^schedule-item-/, '')
      const realGroupId = targetGroupId?.replace(/^schedule-group-/, '') || null

      const item = formData.items.find((i) => i.id === realItemId)
      if (!item || item.scheduleGroupId === realGroupId) return

      const itemsInTargetGroup = formData.items
        .filter((i) => i.scheduleGroupId === realGroupId)
        .sort((a, b) => a.order - b.order)

      const newOrder = itemsInTargetGroup.length

      const updatedItems = formData.items.map((i) =>
        i.id === realItemId ? { ...i, scheduleGroupId: realGroupId, order: newOrder } : i
      )

      form.setValue('items', updatedItems, { shouldDirty: true })
    },
    [formData.items, form]
  )

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

  const itemsSortableIndex = currentSchedule
    .map((g) => {
      return [
        g.items.map((i) => `schedule-item-${i.id}`),
        ...(g.group ? [`schedule-group-${g.group.id}`] : [])
      ].flat()
    })
    .flat()

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
        addGroupToSchedule,
        reorderItems,
        reorderGroups,
        reorderInMainSchedule,
        moveItemToGroup,
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
