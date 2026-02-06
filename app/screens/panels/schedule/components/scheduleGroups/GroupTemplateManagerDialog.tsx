import { useState, useEffect } from 'react'
import { Button } from '@/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { Input } from '@/ui/input'
import { ColorPicker } from '@/ui/colorPicker'
import { Plus, Save, X } from 'lucide-react'
import ScheduleGruopItem from './scheduleGruopItem'
import { ScheduleGroupTemplateDTO } from 'database/controllers/schedule/schedule.dto'

type GroupTemplateManagerProps = {
  children: React.ReactNode
}

export default function GroupTemplateManager({ children }: GroupTemplateManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [templates, setTemplates] = useState<ScheduleGroupTemplateDTO[]>([])
  const [editingTemplate, setEditingTemplate] = useState<ScheduleGroupTemplateDTO | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form state for new/edit template
  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6'
  })

  // Load templates when popover opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const result = await window.api.schedule.getAllGroupTemplates()
      setTemplates(result)
    } catch (error) {
      console.error('Error loading group templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    if (!formData.name.trim()) return

    try {
      const newTemplate = await window.api.schedule.createGroupTemplate({
        name: formData.name.trim(),
        color: formData.color
      })

      setTemplates((prev) => [...prev, newTemplate])
      resetForm()
      setIsCreating(false)
    } catch (error) {
      console.error('Error creating template:', error)
      alert('Error al crear el template de grupo')
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !formData.name.trim()) return

    try {
      const updatedTemplate = await window.api.schedule.updateGroupTemplate(editingTemplate.id, {
        name: formData.name.trim(),
        color: formData.color
      })

      setTemplates((prev) => prev.map((t) => (t.id === editingTemplate.id ? updatedTemplate : t)))
      resetForm()
      setEditingTemplate(null)
    } catch (error) {
      console.error('Error updating template:', error)
      alert('Error al actualizar el template de grupo')
    }
  }

  const handleDeleteTemplate = async (template: ScheduleGroupTemplateDTO) => {
    if (template.scheduleGroups && template.scheduleGroups.length > 0) {
      alert('No se puede eliminar un template que tiene grupos asociados')
      return
    }

    if (!confirm(`¿Estás seguro de eliminar el template "${template.name}"?`)) {
      return
    }

    try {
      await window.api.schedule.deleteGroupTemplate(template.id)
      setTemplates((prev) => prev.filter((t) => t.id !== template.id))
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Error al eliminar el template de grupo')
    }
  }

  const startEdit = (template: ScheduleGroupTemplateDTO, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      color: template.color
    })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      color: '#3b82f6'
    })
    setEditingTemplate(null)
    setIsCreating(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="right">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">Grupos de Schedule</h4>
          <p className="text-xs text-muted-foreground">
            Arrastra un grupo al cronograma para organizarlo
          </p>
        </div>

        <div className="max-h-80 overflow-hidden flex flex-col">
          {/* Create/Edit Form */}
          {(isCreating || editingTemplate) && (
            <div className="p-3 border-b bg-muted/20">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {editingTemplate ? 'Editar Grupo' : 'Nuevo Grupo'}
                </div>
                <div className="flex gap-2 items-end">
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre del grupo"
                    className="flex-1 h-8 text-sm"
                  />
                  <ColorPicker
                    value={formData.color}
                    onChange={(color) => setFormData((prev) => ({ ...prev, color }))}
                    className="w-8 h-8"
                  />
                </div>
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={resetForm} className="h-7 px-2">
                    <X className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                    disabled={!formData.name.trim()}
                    className="h-7 px-3"
                  >
                    <Save className="h-3 w-3" />
                    {editingTemplate ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add New Button */}
          {!isCreating && !editingTemplate && (
            <div className="p-3 border-b">
              <Button
                onClick={() => setIsCreating(true)}
                className="w-full h-8"
                variant="outline"
                size="sm"
              >
                <Plus className="h-3 w-3 mr-1" />
                Nuevo Grupo
              </Button>
            </div>
          )}

          {/* Templates List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-6 text-muted-foreground text-xs">
                Cargando grupos...
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">
                No hay grupos creados
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {templates.map((template) => (
                  <ScheduleGruopItem
                    key={template.id}
                    template={template}
                    startEdit={startEdit}
                    handleDeleteTemplate={handleDeleteTemplate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
