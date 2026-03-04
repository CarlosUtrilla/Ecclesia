import { memo, useCallback } from 'react'
import { Play } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Button } from '@/ui/button'
import { animations } from '@/lib/animations'
import { AnimationSettings } from '@/lib/animationSettings'
import AnimationEditor from './animationEditor'

type AnimationSelectorProps = {
  settings: AnimationSettings
  onChange: (settings: AnimationSettings) => void
  onPreview?: () => void
  label?: string
}

const AnimationSelector = memo(function AnimationSelector({
  settings,
  onChange,
  onPreview,
  label = 'Animación:'
}: AnimationSelectorProps) {
  const handleTypeChange = useCallback(
    (val: string) => onChange({ ...settings, type: val }),
    [settings, onChange]
  )

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-2">
        <Select value={settings.type} onValueChange={handleTypeChange}>
          <SelectTrigger size="sm" className="w-[180px] !h-9">
            <SelectValue placeholder="Seleccionar animación" />
          </SelectTrigger>
          <SelectContent>
            {animations.map((animation) => {
              const AnimIcon = animation.icon
              return (
                <SelectItem key={animation.value} value={animation.value}>
                  <div className="flex items-center gap-2">
                    <AnimIcon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex flex-col text-left ">
                      <span>{animation.label}</span>
                      <span className="text-xs text-muted-foreground -mt-0.5">
                        {animation.description}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        {onPreview && (
          <Button
            type="button"
            size="sm"
            onClick={onPreview}
            className="h-8 w-8 p-0"
            title="Vista previa de la animación"
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
        <AnimationEditor settings={settings} onChange={onChange} />
      </div>
    </div>
  )
})

export default AnimationSelector
