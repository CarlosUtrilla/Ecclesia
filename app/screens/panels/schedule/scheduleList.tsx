import { useState } from 'react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog'
import { Label } from '@/ui/label'
import { Calendar, Edit, Plus, Trash2, Clock } from 'lucide-react'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  const { currentSchedule, loadSchedule, createTemporarySchedule, isTemporary } = useSchedule()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    hasDate: true
  })

  // Obtener lista de schedules
  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const data = await window.api.schedule.getAllSchedules()
      return data.map((s: any) => ({
        ...s,
        date: new Date(s.date)
      }))
    }
  })

  // Crear schedule
  const createMutation = useMutation({
    mutationFn: async (data: { title: string; date?: Date }) => {
      return await window.api.schedule.createSchedule(data.title, data.date)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setIsDialogOpen(false)
      resetForm()
    }
  })

  // Actualizar schedule
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; title: string; date?: Date }) => {
      return await window.api.schedule.updateSchedule(data.id, {
        title: data.title,
        date: data.date
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setIsDialogOpen(false)
      resetForm()
      setEditingSchedule(null)
    }
  })

  // Eliminar schedule
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await window.api.schedule.deleteSchedule(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
    }
  })

  const resetForm = () => {
    setFormData({
      title: '',
      date: new Date().toISOString().split('T')[0],
      hasDate: true
    })
  }

  const handleCreate = () => {
    setEditingSchedule(null)
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setFormData({
      title: schedule.title,
      date: schedule.date ? new Date(schedule.date).toISOString().split('T')[0] : '',
      hasDate: !!schedule.date
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este schedule?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleSubmit = () => {
    const submitData = {
      title: formData.title,
      date: formData.hasDate ? new Date(formData.date) : undefined
    }

    if (editingSchedule) {
      updateMutation.mutate({ id: editingSchedule.id, ...submitData })
    } else {
      createMutation.mutate(submitData)
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
          variant="outline"
          className="w-full text-xs"
          onClick={() => {
            createTemporarySchedule()
            onScheduleSelect()
          }}
        >
          <Clock className="h-3 w-3" />
          Sesión Temporal
        </Button>
      </div>

      {/* Lista de schedules */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Sesión temporal si está activa */}
        {isTemporary && currentSchedule && (
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
                  <span className="text-xs font-medium truncate">{currentSchedule.title}</span>
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
                  currentSchedule?.id === schedule.id && !isTemporary
                    ? 'bg-primary/10 border border-primary'
                    : 'bg-background border border-transparent'
                }`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  loadSchedule(schedule.id)
                  onScheduleSelect()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    loadSchedule(schedule.id)
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

      {/* Dialog para crear/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Editar Schedule' : 'Nuevo Schedule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Nombre</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Culto Dominical"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasDate"
                  checked={formData.hasDate}
                  onChange={(e) => setFormData({ ...formData, hasDate: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="hasDate">Asignar fecha</Label>
              </div>
              {formData.hasDate && (
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.title.trim()}>
              {editingSchedule ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
