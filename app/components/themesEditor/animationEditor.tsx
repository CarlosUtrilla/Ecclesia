import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Slider } from '@/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Settings2, Play } from 'lucide-react'
import { animations, AnimationType } from '@/lib/animations'
import { AnimationSettings, defaultAnimationSettings, easingOptions } from '@/lib/animationSettings'
import { motion, AnimatePresence } from 'framer-motion'
import { getAnimationVariants } from '@/lib/animations'

type AnimationEditorProps = {
  settings: AnimationSettings
  onChange: (settings: AnimationSettings) => void
}

export default function AnimationEditor({ settings, onChange }: AnimationEditorProps) {
  const [open, setOpen] = useState(false)
  const [localSettings, setLocalSettings] = useState<AnimationSettings>(settings)
  const [previewKey, setPreviewKey] = useState(0)

  const handleSave = () => {
    onChange(localSettings)
    setOpen(false)
  }

  const handlePreview = () => {
    setPreviewKey((prev) => prev + 1)
  }

  const updateSetting = <K extends keyof AnimationSettings>(
    key: K,
    value: AnimationSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
  }

  const variants = getAnimationVariants(
    localSettings.type as AnimationType,
    localSettings.duration,
    localSettings.delay,
    localSettings.easing
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="text-xs">Configurar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configuración de Animación</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Tipo de Animación */}
          <div className="space-y-2">
            <Label>Tipo de Animación</Label>
            <Select
              value={localSettings.type}
              onValueChange={(value) => updateSetting('type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {animations.map((animation) => {
                  const AnimIcon = animation.icon
                  return (
                    <SelectItem key={animation.value} value={animation.value}>
                      <div className="flex items-center gap-2">
                        <AnimIcon className="h-4 w-4" />
                        <span>{animation.label}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Duración */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Duración</Label>
              <span className="text-sm text-muted-foreground">{localSettings.duration}s</span>
            </div>
            <Slider
              min={0.1}
              max={3}
              step={0.1}
              value={[localSettings.duration]}
              onValueChange={([value]) => updateSetting('duration', value)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Rápido (0.1s)</span>
              <span>Lento (3s)</span>
            </div>
          </div>

          {/* Retraso */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Retraso (Delay)</Label>
              <span className="text-sm text-muted-foreground">{localSettings.delay}s</span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={[localSettings.delay]}
              onValueChange={([value]) => updateSetting('delay', value)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Sin retraso (0s)</span>
              <span>Máximo (2s)</span>
            </div>
          </div>

          {/* Curva de Aceleración */}
          <div className="space-y-2">
            <Label>Curva de Aceleración (Easing)</Label>
            <Select
              value={localSettings.easing}
              onValueChange={(value) => updateSetting('easing', value as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {easingOptions.map((easing) => (
                  <SelectItem key={easing.value} value={easing.value}>
                    {easing.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vista Previa */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Vista Previa</Label>
              <Button size="sm" variant="outline" onClick={handlePreview}>
                <Play className="h-3 w-3 mr-1" />
                Reproducir
              </Button>
            </div>
            <div className="h-32 border rounded-lg flex items-center justify-center bg-muted/20 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={previewKey}
                  variants={variants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="px-8 py-4 bg-primary text-primary-foreground rounded-md font-medium"
                >
                  Texto de ejemplo
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setLocalSettings(defaultAnimationSettings)
              handlePreview()
            }}
          >
            Restablecer
          </Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
