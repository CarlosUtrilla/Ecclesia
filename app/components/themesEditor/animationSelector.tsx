import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { animations } from '@/lib/animations'
import { AnimationSettings } from '@/lib/animationSettings'
import AnimationEditor from './animationEditor'

type AnimationSelectorProps = {
  settings: AnimationSettings
  onChange: (settings: AnimationSettings) => void
}

export default function AnimationSelector({ settings, onChange }: AnimationSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground whitespace-nowrap">Animación:</label>
      <div className="flex items-center gap-2">
        <Select value={settings.type} onValueChange={(val) => onChange({ ...settings, type: val })}>
          <SelectTrigger size="sm" className="w-[180px]">
            <SelectValue placeholder="Seleccionar animación" />
          </SelectTrigger>
          <SelectContent>
            {animations.map((animation) => {
              const AnimIcon = animation.icon
              return (
                <SelectItem key={animation.value} value={animation.value}>
                  <div className="flex items-center gap-2">
                    <AnimIcon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span>{animation.label}</span>
                      <span className="text-xs text-muted-foreground">{animation.description}</span>
                    </div>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <AnimationEditor settings={settings} onChange={onChange} />
      </div>
    </div>
  )
}
