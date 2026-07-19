import { Button } from '@/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Calendar, Edit, Trash2, ClockPlus, ArrowLeft } from 'lucide-react'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card } from '@/ui/card'
import { Badge } from '@/ui/badge'
import { Separator } from '@/ui/separator'
import { Input } from '@/ui/input'
import { useState } from 'react'
import { Api } from '@ecclesia/queries'
import { ScrollArea } from '@/ui/scroll-area'

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
  const { createTemporarySchedule, isTemporary, formData, loadSchedule } = useSchedule()

  // Obtener lista de schedules
  const { data: schedules = [], refetch } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const data = await Api.fetch.schedule.getAllSchedules()
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
      return await Api.fetch.schedule.deleteSchedule({ body: { id } })
    },
    onSuccess: () => {
      refetch()
    }
  })

  const handleEdit = (schedule: Schedule) => {
    loadSchedule(schedule.id)
  }

  const handleDelete = (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este schedule?')) {
      deleteMutation.mutate(id)
    }
  }

  const hasActiveSchedule = !!formData

  return (
    <div className="flex flex-col h-full w-full bg-muted/20 panel-scrollable overflow-hidden">
      {/* Header mejorado */}
      <div className="panel-header px-4 pt-4 pb-2 border-b bg-muted/40">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Cronogramas
          </h2>
        </div>
        <div className="flex gap-2 mb-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cronograma..."
            className="flex-1 text-xs px-2 py-1 h-8 rounded-md border border-muted focus:border-primary focus:ring-1 focus:ring-primary bg-background"
            aria-label="Buscar cronograma"
          />
          <Button
            size="sm"
            className="h-8 px-3 text-xs font-semibold flex items-center gap-1.5 shrink-0"
            onClick={() => {
              createTemporarySchedule()
              onScheduleSelect()
            }}
          >
            <ClockPlus className="h-3.5 w-3.5" />
            Nuevo
          </Button>
        </div>
        {hasActiveSchedule && (
          <Button
            size="sm"
            variant="secondary"
            className="w-full justify-start gap-2"
            onClick={onScheduleSelect}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="truncate text-xs font-medium">
              Regresar a "{formData.title || (isTemporary ? 'Sesión Temporal' : 'cronograma')}"
            </span>
          </Button>
        )}
      </div>
      <ScrollArea className="panel-scroll-content ">
        <div className="flex-1 px-2 py-3 space-y-3">
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
      </ScrollArea>
    </div>
  )
}
