import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Radio, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Switch } from '@/ui/switch'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { cn } from '@/lib/utils'
import type { NdiOutputConfig } from 'electron/main/ndiManager/ndiConfig'
import type { NdiStatus } from 'electron/main/ndiManager'

// Resoluciones ofrecidas en el selector. La salida NDI es 16:9; si la proyección
// tiene otra relación de aspecto, el contenido se ajusta al frame emitido.
const RESOLUTION_OPTIONS = [
  { label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 },
  { label: '1280 × 720 (HD)', width: 1280, height: 720 },
  { label: '854 × 480 (SD)', width: 854, height: 480 }
]

const FPS_OPTIONS = [25, 30, 50, 60]

const resolutionValue = (width: number, height: number) => `${width}x${height}`

export default function NdiOutputDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [status, setStatus] = useState<NdiStatus | null>(null)
  const [config, setConfig] = useState<NdiOutputConfig | null>(null)
  const [saving, setSaving] = useState(false)

  const applyStatus = useCallback((next: NdiStatus) => {
    setStatus(next)
    setConfig((previous) => previous ?? next.config)
  }, [])

  // Carga el estado al abrir el diálogo y se suscribe a los cambios del main.
  useEffect(() => {
    if (!open) return

    let cancelled = false

    window.ndiAPI.getStatus().then((next) => {
      if (cancelled) return
      setStatus(next)
      setConfig(next.config)
    })

    const unsubscribe = window.ndiAPI.onStatusChanged((next) => {
      if (!cancelled) applyStatus(next)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [open, applyStatus])

  const updateConfig = (patch: Partial<NdiOutputConfig>) => {
    setConfig((previous) => (previous ? { ...previous, ...patch } : previous))
  }

  const handleSave = async () => {
    if (!config) return

    setSaving(true)
    try {
      const next = await window.ndiAPI.updateConfig(config)
      setStatus(next)
      setConfig(next.config)
    } finally {
      setSaving(false)
    }
  }

  const isUnavailable = status !== null && !status.available

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Salida de vídeo NDI
          </DialogTitle>
          <DialogDescription>
            Emite la pantalla de proyección como fuente NDI en la red local, para mezcladores como
            OBS, vMix o ATEM. Funciona aunque no haya un proyector conectado.
          </DialogDescription>
        </DialogHeader>

        {isUnavailable && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">NDI no disponible en este equipo</p>
              <p className="text-muted-foreground">
                {status?.error ?? 'No se pudo cargar el runtime NDI.'}
              </p>
            </div>
          </div>
        )}

        {config && (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="ndi-enabled">Activar salida NDI</Label>
                <p className="text-xs text-muted-foreground">
                  {status?.active
                    ? `Emitiendo como «${status.sourceName}»`
                    : 'La salida está detenida'}
                </p>
              </div>
              <Switch
                id="ndi-enabled"
                checked={config.enabled}
                disabled={isUnavailable}
                onCheckedChange={(checked) => updateConfig({ enabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ndi-source-name">Nombre de la fuente</Label>
              <Input
                id="ndi-source-name"
                value={config.sourceName}
                maxLength={64}
                disabled={isUnavailable}
                onChange={(event) => updateConfig({ sourceName: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                NDI antepone el nombre del equipo automáticamente.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Resolución</Label>
                <Select
                  value={resolutionValue(config.width, config.height)}
                  disabled={isUnavailable}
                  onValueChange={(value) => {
                    const [width, height] = value.split('x').map(Number)
                    updateConfig({ width, height })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLUTION_OPTIONS.map((option) => (
                      <SelectItem
                        key={resolutionValue(option.width, option.height)}
                        value={resolutionValue(option.width, option.height)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fotogramas por segundo</Label>
                <Select
                  value={String(config.fps)}
                  disabled={isUnavailable}
                  onValueChange={(value) => updateConfig({ fps: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FPS_OPTIONS.map((fps) => (
                      <SelectItem key={fps} value={String(fps)}>
                        {fps} fps
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    status?.active ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                  )}
                />
                {status?.active ? 'Emitiendo' : 'Detenida'}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                {status?.connections ?? 0} receptor(es)
              </span>
              {status?.ndiVersion && (
                <span className="text-muted-foreground">{status.ndiVersion}</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handleSave} disabled={!config || saving || isUnavailable}>
            {saving ? 'Aplicando...' : 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
