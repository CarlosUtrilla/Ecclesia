import { Button } from '@/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Calendar, Edit, Plus, Trash2, Clock, ClockPlus } from 'lucide-react'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type Schedule = {
  id: number
  title: string
  date: Date
  createdAt: Date
  updatedAt: Date
}

type ScheduleListProps = {
  onScheduleSelect: () => void
}

export default function ScheduleList({ onScheduleSelect }: ScheduleListProps) {
  const { createTemporarySchedule, isTemporary, formData, cleanForm, loadSchedule } = useSchedule()

  // Obtener lista de schedules
  const { data: schedules = [], refetch } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const data = await window.api.schedule.getAllSchedules()
      return data.map((s: any) => ({
        ...s,
        date: s.date ? new Date(s.date) : null
      }))
    }
  })

  // Eliminar schedule
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await window.api.schedule.deleteSchedule(id)
    },
    onSuccess: () => {
      refetch()
    }
  })

  const handleCreate = () => {
    cleanForm()
  }

  const handleEdit = (schedule: Schedule) => {
    loadSchedule(schedule.id)
  }

  const handleDelete = (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este schedule?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-muted/20">
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/40">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold">Schedules</h2>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Button
          size="sm"
          className="w-full text-xs"
          onClick={() => {
            createTemporarySchedule()
            onScheduleSelect()
          }}
        >
          <ClockPlus className="h-3 w-3" />
          Nuevo cronograma
        </Button>
      </div>

      {/* Lista de schedules */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Sesión temporal si está activa */}
        {isTemporary && formData && (
          <div
            className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/20 border-2 border-amber-500 cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={onScheduleSelect}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onScheduleSelect()
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-600" />
                  <span className="text-xs font-medium truncate">{formData.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">Sin guardar</span>
              </div>
            </div>
          </div>
        )}

        {schedules.map((schedule) => (
          <ContextMenu key={schedule.id}>
            <ContextMenuTrigger>
              <div
                className={`p-2 rounded-md cursor-pointer transition-colors hover:bg-muted ${
                  formData?.id === schedule.id && !isTemporary
                    ? 'bg-primary/10 border border-primary'
                    : 'bg-background border border-transparent'
                }`}
                role="button"
                tabIndex={0}
                onClick={async () => {
                  await loadSchedule(schedule.id)
                  onScheduleSelect()
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    await loadSchedule(schedule.id)
                    onScheduleSelect()
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{schedule.title}</h3>
                    {schedule.date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(schedule.date), 'PPP', { locale: es })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => handleEdit(schedule)}>
                <Edit className="h-4 w-4" />
                Editar
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleDelete(schedule.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    </div>
  )
}
