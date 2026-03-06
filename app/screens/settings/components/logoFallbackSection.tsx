import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, Trash2, Video } from 'lucide-react'
import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { ColorPicker } from '@/ui/colorPicker'
import { MediaPicker, type Media } from '@/screens/panels/library/media/exports'
import { useMediaServer } from '@/contexts/MediaServerContext'

type LogoFallbackSettingKey = 'LOGO_FALLBACK_MEDIA_ID' | 'LOGO_FALLBACK_COLOR'

const FALLBACK_MEDIA_KEY: LogoFallbackSettingKey = 'LOGO_FALLBACK_MEDIA_ID'
const FALLBACK_COLOR_KEY: LogoFallbackSettingKey = 'LOGO_FALLBACK_COLOR'
const DEFAULT_FALLBACK_COLOR = '#000000'

export default function LogoFallbackSection() {
  const queryClient = useQueryClient()
  const { buildMediaUrl } = useMediaServer()
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['settings', 'logoFallback'],
    queryFn: () => window.api.setttings.getSettings([FALLBACK_MEDIA_KEY, FALLBACK_COLOR_KEY]),
    staleTime: Infinity
  })

  const fallbackMediaId = settings?.find((s) => s.key === FALLBACK_MEDIA_KEY)?.value ?? null
  const fallbackColor =
    settings?.find((s) => s.key === FALLBACK_COLOR_KEY)?.value ?? DEFAULT_FALLBACK_COLOR

  const { data: mediaRecord } = useQuery({
    queryKey: ['media', 'fallback', fallbackMediaId],
    queryFn: () => window.api.media.getMediaByIds([parseInt(fallbackMediaId!)]),
    enabled: fallbackMediaId !== null,
    staleTime: Infinity
  })

  const media = mediaRecord?.[0] ?? null

  const { mutate: saveSettings } = useMutation({
    mutationFn: (updates: { key: LogoFallbackSettingKey; value: string }[]) =>
      window.api.setttings.updateSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'logoFallback'] })
    }
  })

  const handleSelectMedia = (selected: Media) => {
    saveSettings([{ key: FALLBACK_MEDIA_KEY, value: String(selected.id) }])
    queryClient.invalidateQueries({ queryKey: ['media', 'fallback'] })
    setIsPickerOpen(false)
  }

  const handleRemoveMedia = () => {
    saveSettings([{ key: FALLBACK_MEDIA_KEY, value: '' }])
    queryClient.invalidateQueries({ queryKey: ['media', 'fallback'] })
  }

  const handleColorChange = (color: string) => {
    saveSettings([{ key: FALLBACK_COLOR_KEY, value: color }])
  }

  const thumbnailSrc = media ? buildMediaUrl(media.thumbnail ?? media.filePath) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo / Pantalla de fondo</CardTitle>
        <CardDescription>
          Recurso que se muestra en las pantallas en vivo cuando no hay contenido activo. Siempre
          visible por debajo de los fondos de los temas.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Recurso multimedia */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Recurso de fondo</p>
          <p className="text-xs text-muted-foreground">
            Imagen o video que se proyectará como fondo permanente en las pantallas en vivo.
          </p>

          <div className="flex items-center gap-3 mt-2">
            {/* Preview */}
            <div className="relative w-28 h-16 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden flex-shrink-0">
              {thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt={media?.name ?? 'Logo'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground" />
              )}
              {media?.type === 'VIDEO' && (
                <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5">
                  <Video className="size-3 text-white" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {media ? (
                <p className="text-sm font-medium truncate max-w-[180px]">{media.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Sin recurso seleccionado</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsPickerOpen(true)}>
                  {media ? 'Cambiar' : 'Seleccionar'}
                </Button>
                {media && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveMedia}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Color de fondo de respaldo */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Color de fondo de respaldo</p>
          <p className="text-xs text-muted-foreground">
            Se usa cuando el recurso no está disponible o no se ha seleccionado ninguno.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <ColorPicker value={fallbackColor} onChange={handleColorChange} />
            <span className="text-sm text-muted-foreground font-mono">{fallbackColor}</span>
          </div>
        </div>
      </CardContent>

      <MediaPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handleSelectMedia}
        title="Seleccionar logo / pantalla de fondo"
      />
    </Card>
  )
}
