import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { useDraggable } from '@dnd-kit/core'
import { ScheduleGroupTemplateDTO } from 'database/controllers/schedule/schedule.dto'
import { Edit2, GripVertical, Trash2 } from 'lucide-react'

type Props = {
  template: ScheduleGroupTemplateDTO
  startEdit?: (template: ScheduleGroupTemplateDTO, e: React.MouseEvent) => void
  handleDeleteTemplate?: (template: ScheduleGroupTemplateDTO) => void
}

export default function ScheduleGruopItem({ template, startEdit, handleDeleteTemplate }: Props) {
  const { setNodeRef, attributes, listeners } = useDraggable({
    id: `template-${template.id}`,
    data: {
      type: 'schedule-group',
      template
    }
  })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-grab active:cursor-grabbing',
        'border border-transparent hover:border-muted-foreground/20'
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <div
        className="w-3 h-3 rounded-full border flex-shrink-0"
        style={{ backgroundColor: template.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{template.name}</div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => startEdit && startEdit(template, e)}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            handleDeleteTemplate && handleDeleteTemplate(template)
          }}
          disabled={template.scheduleGroups && template.scheduleGroups.length > 0}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
