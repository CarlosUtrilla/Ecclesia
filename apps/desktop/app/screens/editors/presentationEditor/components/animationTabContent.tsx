import { Play, Zap } from 'lucide-react'
import { Button } from '@/ui/button'
import { Slider } from '@/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { animations } from '@/lib/animations'
import { cn } from '@/lib/utils'
import type { AnimationSettings, EasingType } from '@/lib/animationSettings'
import type { PresentationSlide, PresentationSlideItem } from '../utils/slideUtils'

type Props = {
  selectedItem: PresentationSlideItem | undefined
  selectedSlide: PresentationSlide | undefined
  selectedItemAnimationSettings: AnimationSettings
  selectedSlideTransitionSettings: AnimationSettings
  easingOptions: Array<{ value: EasingType; label: string }>
  onSelectedItemAnimationChange: (settings: AnimationSettings) => void
  onSelectedSlideTransitionChange: (settings: AnimationSettings) => void
  onAnimationPreview: () => void
}

export default function AnimationTabContent({
  selectedItem,
  selectedSlide,
  selectedItemAnimationSettings,
  selectedSlideTransitionSettings,
  easingOptions,
  onSelectedItemAnimationChange,
  onSelectedSlideTransitionChange,
  onAnimationPreview
}: Props) {
  if (!selectedItem) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-2 px-4">
        <Zap className="size-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Selecciona un elemento para configurar su animación
        </p>
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Animación de elementos
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {animations.map((anim) => {
            const AnimIcon = anim.icon
            return (
              <button
                key={anim.value}
                type="button"
                className={cn(
                  'flex flex-col items-center gap-1.5 p-2 rounded-lg border text-center transition-colors',
                  selectedItemAnimationSettings.type === anim.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                )}
                onClick={() =>
                  onSelectedItemAnimationChange({
                    ...selectedItemAnimationSettings,
                    type: anim.value
                  })
                }
              >
                <AnimIcon className="size-5" />
                <span className="text-[10px] leading-tight">{anim.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Duración</span>
          <span className="text-xs tabular-nums">{selectedItemAnimationSettings.duration}s</span>
        </div>
        <Slider
          value={[selectedItemAnimationSettings.duration]}
          min={0.1}
          max={3}
          step={0.1}
          onValueChange={([v]) =>
            onSelectedItemAnimationChange({
              ...selectedItemAnimationSettings,
              duration: v
            })
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Retraso</span>
          <span className="text-xs tabular-nums">{selectedItemAnimationSettings.delay}s</span>
        </div>
        <Slider
          value={[selectedItemAnimationSettings.delay]}
          min={0}
          max={2}
          step={0.1}
          onValueChange={([v]) =>
            onSelectedItemAnimationChange({
              ...selectedItemAnimationSettings,
              delay: v
            })
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Easing</span>
        <Select
          value={selectedItemAnimationSettings.easing}
          onValueChange={(v) =>
            onSelectedItemAnimationChange({
              ...selectedItemAnimationSettings,
              easing: v as EasingType
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {easingOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedItem.type !== 'MEDIA' && (
        <Button size="sm" className="w-full" onClick={onAnimationPreview}>
          <Play className="size-3.5 mr-2" />
          Previsualizar
        </Button>
      )}

      {selectedSlide && (
        <div className="flex flex-col gap-3 pt-3 border-t">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Transición de diapositivas
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {animations.map((anim) => {
              const AnimIcon = anim.icon
              return (
                <button
                  key={anim.value}
                  type="button"
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-lg border text-center transition-colors',
                    selectedSlideTransitionSettings.type === anim.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50'
                  )}
                  onClick={() =>
                    onSelectedSlideTransitionChange({
                      ...selectedSlideTransitionSettings,
                      type: anim.value
                    })
                  }
                >
                  <AnimIcon className="size-5" />
                  <span className="text-[10px] leading-tight">{anim.label}</span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Duración</span>
              <span className="text-xs tabular-nums">
                {selectedSlideTransitionSettings.duration}s
              </span>
            </div>
            <Slider
              value={[selectedSlideTransitionSettings.duration]}
              min={0.1}
              max={3}
              step={0.1}
              onValueChange={([v]) =>
                onSelectedSlideTransitionChange({
                  ...selectedSlideTransitionSettings,
                  duration: v
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
