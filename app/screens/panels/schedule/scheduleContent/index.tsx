import { Button } from '@/ui/button'
import { AnimatePresence, m, LazyMotion, domAnimation } from 'framer-motion'
import { useSchedule } from '@/contexts/ScheduleContext'
import { Save, CalendarSearch, Upload } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ScheduleItem } from '@prisma/client'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import GroupTemplateManager from '../components/scheduleGroups/GroupTemplateManagerDialog'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import EmptyShcedule from './emptyShcedule'
import PreviewSchedule from './previewSchedule'
import { useRef as useReactRef } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import InsertionDropZone from './insertionDropZone'
import { ScheduleItemComponent } from './scheduleItem'

type ScheduleContentProps = {
  onBack: () => void
}

function ScheduleContentComponent({ onBack }: ScheduleContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { active } = useDndContext()
  const { isOver, setNodeRef } = useDroppable({
    id: 'schedule-drop-area'
  })
  const {
    currentSchedule,
    form,
    getScheduleItemContentScreen,
    selectedTheme,
    saveScheduleChanges,
    itemsSortableIndex,
    deleteItemFromSchedule
  } = useSchedule()
  const { showItemOnLiveScreen } = useLive()

  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null)
  const [itemContent, setItemContent] = useState<PresentationViewItems[] | null>(null)
  const previewRef = useReactRef<HTMLDivElement>(null)
  const themeSelectorRef = useReactRef<HTMLDivElement | null>(null)

  const refreshSelectedItemContent = useCallback(async () => {
    if (!selectedItem) {
      setItemContent(null)
      return
    }

    const content = await getScheduleItemContentScreen(selectedItem)
    setItemContent(content.content)
  }, [getScheduleItemContentScreen, selectedItem])

  useEffect(() => {
    refreshSelectedItemContent()
  }, [refreshSelectedItemContent])

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('presentation-saved', () => {
      if (selectedItem?.type !== 'PRESENTATION') return
      refreshSelectedItemContent()
    })

    return unsubscribe
  }, [refreshSelectedItemContent, selectedItem?.type])

  useLayoutEffect(() => {
    const el = document.getElementById('theme-selector') as HTMLDivElement
    if (el) {
      themeSelectorRef.current = el
    }
  }, [])

  useKeyboardShortcuts(
    containerRef,
    {
      onDelete: () => {
        console.log('Delete key pressed')
        if (selectedItem) {
          const index = currentSchedule.findIndex((i) => i.id === selectedItem.id)
          if (index !== -1) {
            deleteItemFromSchedule(index)
            setSelectedItem(null)
          }
        }
      },
      onClickOutside: () => {
        setSelectedItem(null)
      }
    },
    itemContent && itemContent.length && selectedItem
      ? [previewRef, themeSelectorRef]
      : [themeSelectorRef]
  )

  if (!currentSchedule) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">No hay ningún schedule seleccionado.</p>
      </div>
    )
  }

  const {
    formState: { isDirty }
  } = form
  const pendingSave = isDirty

  return (
    <>
      <div
        className={cn('h-full flex flex-col', {
          'h-7/12': itemContent && itemContent.length && selectedItem
        })}
        ref={containerRef}
        tabIndex={0}
        style={{ outline: 'none' }}
      >
        {/* Header editable del schedule */}
        <div className="px-4 py-3 border-b bg-muted/20 flex flex-col gap-2">
          {/* Input y botón Guardar en la misma fila */}
          <div className="flex items-center gap-2 w-full max-w-xl">
            <input
              className={cn(
                'font-medium text-base bg-background border rounded-md outline-none focus:ring-2 focus:ring-primary px-2 py-0.5 flex-1 transition-all',
                form.formState.errors.title ? 'border-destructive' : 'border-muted/40'
              )}
              value={form.getValues('title') || ''}
              onChange={(e) => {
                form.clearErrors('title')
                form.setValue('title', e.target.value, { shouldDirty: true })
              }}
              placeholder="Sesión Temporal"
              maxLength={48}
              aria-label="Nombre del cronograma"
              style={{ minWidth: 180, height: '1.6rem' }}
            />
            <Button size="sm" disabled={!pendingSave} onClick={saveScheduleChanges}>
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </div>
          {form.formState.errors.title && (
            <span className="text-destructive text-xs mt-1">
              {form.formState.errors.title.message as string}
            </span>
          )}
          {/* Botones secundarios debajo */}
          <div className="flex items-center gap-2 flex-wrap justify-end mt-1">
            <GroupTemplateManager>
              <Button size="sm">Grupos</Button>
            </GroupTemplateManager>
            <Button size="sm" onClick={onBack}>
              <CalendarSearch className="h-4 w-4" />
              Cronogramas
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3" ref={setNodeRef} data-schedule-container="true">
          {currentSchedule.length === 0 ? (
            <EmptyShcedule isOver={isOver} />
          ) : (
            <div className="min-h-full transition-colors relative">
              <div className="flex flex-col">
                <SortableContext items={itemsSortableIndex} strategy={verticalListSortingStrategy}>
                  {/* Zona de inserción al principio */}
                  <div className="mb-1">
                    <InsertionDropZone position={0} isFirst={true} />
                  </div>

                  {(() => {
                    let lastGroup: string | undefined = undefined
                    return currentSchedule.map((item, index) => {
                      if (item.type === 'GROUP') {
                        lastGroup = item.accessData
                      }
                      return (
                        <ScheduleItemComponent
                          key={`item-${item.id}`}
                          item={item}
                          setSelectedItem={setSelectedItem}
                          selectedItem={selectedItem}
                          groupId={lastGroup}
                          insertPosition={index + 1}
                          isLast={index === currentSchedule.length - 1}
                        />
                      )
                    })
                  })()}
                </SortableContext>
              </div>
              <LazyMotion features={domAnimation}>
                <AnimatePresence>
                  {isOver &&
                    (() => {
                      const isExternalDrag =
                        active?.data.current?.accessData !== undefined &&
                        !active?.data.current?.item

                      if (!isExternalDrag) return null
                      return (
                        <m.div
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.2 }}
                          className="absolute animate-in fade-in duration-300 -inset-2 flex items-center justify-center pointer-events-none bg-primary/10 rounded-md border-2 border-dashed border-primary"
                        >
                          <div className="mt-4 p-8 border-2 border-dashed border-primary rounded-lg bg-primary/5 text-center">
                            <Upload className="h-12 w-12 mx-auto mb-2 text-primary" />
                            <p className="text-sm text-primary font-medium">
                              Soltar para agregar al final
                            </p>
                          </div>
                        </m.div>
                      )
                    })()}
                </AnimatePresence>
              </LazyMotion>
            </div>
          )}
        </div>
      </div>
      {itemContent && itemContent.length && selectedItem ? (
        <PreviewSchedule
          ref={previewRef}
          itemContent={itemContent}
          selectedItem={selectedItem}
          selectedTheme={selectedTheme}
          onLivePresentation={(index) => {
            showItemOnLiveScreen(selectedItem, index)
            setSelectedItem(null)
          }}
        />
      ) : null}
    </>
  )
}

export default function ScheduleContent({ onBack }: ScheduleContentProps) {
  return <ScheduleContentComponent onBack={onBack} />
}
