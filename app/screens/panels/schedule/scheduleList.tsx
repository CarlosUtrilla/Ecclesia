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
import { Card } from '@/ui/card'
import { Badge } from '@/ui/badge'
import { Separator } from '@/ui/separator'
import { Input } from '@/ui/input'
import { useState } from 'react'

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

  // Estado para búsqueda
  const [search, setSearch] = useState('')
  const filteredSchedules = schedules.filter((s: Schedule) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  )

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
    <div className="flex flex-col h-full w-full bg-muted/20 panel-scrollable">
      {/* Header mejorado */}
      <div className="panel-header px-4 pt-4 pb-2 border-b bg-muted/40">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Cronogramas
          </h2>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={handleCreate}
            aria-label="Nuevo cronograma"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cronograma..."
          className="w-full mb-2 text-xs px-2 py-1 h-8 rounded-md border border-muted focus:border-primary focus:ring-1 focus:ring-primary bg-background"
          aria-label="Buscar cronograma"
        />
        <Button
          size="sm"
          className="w-full text-xs font-semibold flex items-center gap-2"
          onClick={() => {
            createTemporarySchedule()
            onScheduleSelect()
          }}
        >
          <ClockPlus className="h-4 w-4" />
          Nuevo cronograma
        </Button>
      </div>
      <div className="panel-scroll-content flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {/* Sesión temporal si está activa */}
        {isTemporary && formData && (
          <Card
            className="p-2 border-amber-500 bg-amber-50 dark:bg-amber-900/20 cursor-pointer transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-amber-400 outline-none"
            tabIndex={0}
            role="button"
            aria-label="Volver al cronograma temporal"
            onClick={onScheduleSelect}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onScheduleSelect()
              }
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="font-semibold text-sm truncate flex-1">
                {formData.title || 'Cronograma temporal'}
              </span>
              <Badge
                variant="outline"
                className="border-amber-500 text-amber-700 bg-amber-100 dark:bg-amber-900/40"
              >
                Temporal
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">Sin guardar</span>
          </Card>
        )}
        <Separator className="my-1" />
        {filteredSchedules.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-8 select-none">
            No hay cronogramas encontrados
          </div>
        )}
        {filteredSchedules.map((schedule) => (
          <ContextMenu key={schedule.id}>
            <ContextMenuTrigger>
              <Card
                className={`cursor-pointer transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-primary outline-none ${
                  formData?.id === schedule.id && !isTemporary
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent bg-background'
                }`}
                tabIndex={0}
                role="button"
                aria-label={`Abrir cronograma ${schedule.title}`}
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
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm truncate flex-1">{schedule.title}</span>
                  <Badge variant="outline" className="border-primary text-primary bg-primary/10">
                    Guardado
                  </Badge>
                </div>
                {schedule.date && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(schedule.date), 'PPP', { locale: es })}
                  </span>
                )}
              </Card>
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
