import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import {
  BIBLE_LIVE_SPLIT_MODE_OPTIONS,
  type BibleLiveSplitMode,
  isBibleLiveSplitMode,
  resolveBibleChunkMaxLength
} from '@/lib/splitLongBibleVerse'

const BIBLE_LIVE_CHUNK_MODE_KEY = 'BIBLE_LIVE_CHUNK_MODE'
const DEFAULT_MODE: BibleLiveSplitMode = 'auto'

const OPTION_LABELS: Record<BibleLiveSplitMode, string> = {
  auto: 'Auto',
  '100': '100 caracteres',
  '150': '150 caracteres',
  '200': '200 caracteres',
  '250': '250 caracteres'
}

export default function BibleLiveSection() {
  const queryClient = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['settings', 'bibleLive'],
    queryFn: () => window.api.setttings.getSettings([BIBLE_LIVE_CHUNK_MODE_KEY as never]),
    staleTime: Infinity
  })

  const rawMode = settings?.find((setting) => setting.key === BIBLE_LIVE_CHUNK_MODE_KEY)?.value
  const mode = isBibleLiveSplitMode(rawMode) ? rawMode : DEFAULT_MODE

  const { mutate: saveSettings } = useMutation({
    mutationFn: (value: BibleLiveSplitMode) =>
      window.api.setttings.updateSettings([{ key: BIBLE_LIVE_CHUNK_MODE_KEY as never, value }]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'bibleLive'] })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biblia en vivo</CardTitle>
        <CardDescription>
          Controla cómo se dividen automáticamente los versículos largos en múltiples partes para
          mantener la lectura legible en live.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Longitud máxima por fragmento</p>
          <p className="text-xs text-muted-foreground">
            El modo Auto calcula el límite según el tamaño de fuente del tema activo. Los modos
            fijos fuerzan un máximo estable por cantidad de caracteres.
          </p>

          <Select value={mode} onValueChange={(value) => saveSettings(value as BibleLiveSplitMode)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Selecciona un modo" />
            </SelectTrigger>
            <SelectContent>
              {BIBLE_LIVE_SPLIT_MODE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {OPTION_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {mode === 'auto'
            ? `Auto actual: aprox. ${resolveBibleChunkMaxLength('auto', 72)} caracteres con una fuente base de 72px; aumenta o reduce según el fontSize real del tema.`
            : `Modo fijo activo: cada fragmento intentará mantenerse cerca de ${resolveBibleChunkMaxLength(mode)} caracteres, respetando palabras completas y puntuación cercana.`}
        </div>
      </CardContent>
    </Card>
  )
}
