import { Button } from '@/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/ui/dialog'
import { Label } from '@/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Switch } from '@/ui/switch'
import { zodResolver } from '@hookform/resolvers/zod'
import { PropsWithChildren, useEffect, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { BiblePresentationSchema } from './schema'
import { Tooltip } from '@/ui/tooltip'
import type {
  BibleDescriptionMode,
  BibleDescriptionPosition,
  BiblePresentationSettings
} from '@ecclesia/api'
import { PresentationView } from '../../../ui/PresentationView'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useDefaultBiblePresentationSettings } from '@/hooks/useDefaultBiblePresentationSettings'
import { Slider } from '@/ui/slider'
import { ThemeWithMedia } from '../../../ui/PresentationView/types'
import {
  BIBLE_LIVE_SPLIT_MODE_OPTIONS,
  type BibleLiveSplitMode,
  resolveBibleChunkMaxLength,
  splitLongBibleVerse,
  isBibleLiveSplitMode
} from '@/lib/splitLongBibleVerse'
import { Api } from '@ecclesia/queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'

const SAMPLE_TEXT =
  'Por tanto, nosotros también, teniendo en derredor nuestro tan grande nube de testigos, despojémonos de todo peso y del pecado que nos asedia, y corramos con paciencia la carrera que tenemos por delante,'

const CHUNK_MODE_LABELS: Record<BibleLiveSplitMode, string> = {
  auto: 'Auto',
  '100': '100 caracteres',
  '150': '150 caracteres',
  '200': '200 caracteres',
  '250': '250 caracteres'
}

const DEFAULT_BIBLE_EDGE_OFFSET = 10

type Props = {
  hideTooltip?: boolean
  customTheme?: ThemeWithMedia
  customBibleSettings?: Omit<
    BiblePresentationSettings,
    'id' | 'isGlobal' | 'defaultTheme' | 'updatedAt'
  > & {
    id?: number
  }
  setCustomBibleSettings?: (
    value: Omit<BiblePresentationSettings, 'isGlobal' | 'defaultTheme' | 'updatedAt'> & {
      id?: number
    }
  ) => void
} & PropsWithChildren

const toFormValues = (
  source?:
    | (Omit<BiblePresentationSettings, 'id' | 'isGlobal' | 'defaultTheme' | 'updatedAt'> & {
        id?: number
      })
    | null
) => ({
  id: source?.id,
  description: source?.description ?? ('complete' as BibleDescriptionMode),
  position: source?.position ?? ('afterText' as BibleDescriptionPosition),
  showVersion: source?.showVersion ?? true,
  showVerseNumber: source?.showVerseNumber ?? false,
  positionStyle:
    source?.positionStyle === null || source?.positionStyle === undefined
      ? DEFAULT_BIBLE_EDGE_OFFSET
      : source.positionStyle,
  chunkMaxLength: source?.chunkMaxLength ?? 'auto'
})

export default function BiblePresentationConfiguration({
  children,
  hideTooltip,
  customTheme,
  customBibleSettings,
  setCustomBibleSettings
}: Props) {
  const logBibleConfigDebug = (event: string, payload?: Record<string, unknown>) => {
    console.log(`[BibleConfigDialog:Debug] ${event}`, payload || {})
  }

  const { selectedTheme } = useSchedule()
  const [open, setOpen] = useState(false)
  const { defaultBiblePresentationSettings } = useDefaultBiblePresentationSettings()

  const { control, handleSubmit, watch, reset } = useForm({
    defaultValues: toFormValues(customBibleSettings),
    resolver: zodResolver(BiblePresentationSchema)
  })

  const values = watch()

  const { previewText, totalChunks } = useMemo(() => {
    const chunkMode = values.chunkMaxLength
    const maxLength = resolveBibleChunkMaxLength(
      isBibleLiveSplitMode(chunkMode) ? chunkMode : 'auto',
      72
    )
    const chunks = splitLongBibleVerse(SAMPLE_TEXT, maxLength)
    return { previewText: chunks[0] || SAMPLE_TEXT, totalChunks: chunks.length }
  }, [values.chunkMaxLength])

  const onSubmit = (data: any) => {
    logBibleConfigDebug('submit', {
      mode: customBibleSettings && setCustomBibleSettings ? 'custom' : 'global',
      data,
      defaultBibleSettingsId: defaultBiblePresentationSettings?.id
    })

    if (customBibleSettings && setCustomBibleSettings) {
      setCustomBibleSettings(data)
      setOpen(false)
      return
    }

    if (!defaultBiblePresentationSettings?.id) {
      alert('No se pudo resolver la configuración global de Biblia para guardar.')
      return
    }
    console.log(defaultBiblePresentationSettings)

    // Guardar configuración global
    Api.fetch.bible
      .updateDefaultBibleSettings({
        ...data,
        id: defaultBiblePresentationSettings.id,
        isGlobal: true
      })
      .then(() => {
        setOpen(false)
      })
      .catch((err) => {
        console.error('Error al guardar configuración:', err)
        alert('Error al guardar configuración de Biblia')
      })
  }

  useEffect(() => {
    if (!open) return

    logBibleConfigDebug('dialog-open-hydrate-start', {
      hasCustomBibleSettings: Boolean(customBibleSettings),
      hasDefaultBibleSettings: Boolean(defaultBiblePresentationSettings)
    })

    if (customBibleSettings) {
      reset(toFormValues(customBibleSettings))
      logBibleConfigDebug('dialog-open-hydrate-custom', {
        hydratedValues: toFormValues(customBibleSettings)
      })
      return
    }

    if (defaultBiblePresentationSettings) {
      reset(toFormValues(defaultBiblePresentationSettings))
      logBibleConfigDebug('dialog-open-hydrate-global', {
        hydratedValues: toFormValues(defaultBiblePresentationSettings)
      })
    }
  }, [open, reset])

  const positionOptions = [
    { value: 'beforeText', label: 'Antes del texto' },
    { value: 'afterText', label: 'Después del texto' },
    { value: 'underText', label: 'Debajo del texto' },
    { value: 'overText', label: 'Encima del texto' },
    { value: 'upScreen', label: 'Arriba de la pantalla' },
    { value: 'downScreen', label: 'Abajo de la pantalla' }
  ]

  const descriptionOptions = [
    { value: 'short', label: 'Corto (ej: Jua 3:16)' },
    { value: 'complete', label: 'Completo (ej: Juan 3:16)' }
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip content={hideTooltip ? undefined : 'Configurar presentación de Biblia'}>
        <DialogTrigger asChild>{children}</DialogTrigger>
      </Tooltip>
      <DialogContent className="max-h-[90vh] max-w-xl! p-0 overflow-y-auto">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Configuración de presentación de Biblia</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-2 mb-4 p-6 pt-0">
            {/* Modo de descripción */}
            <div className="space-y-2">
              <Label htmlFor="description">Modo de descripción del libro</Label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una modo" />
                    </SelectTrigger>
                    <SelectContent>
                      {descriptionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Posición de la referencia */}
            <div className="space-y-2">
              <Label htmlFor="position">Posición de la referencia</Label>
              <Controller
                name="position"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una posición" />
                    </SelectTrigger>
                    <SelectContent>
                      {positionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Mostrar versión */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="showVersion">Mostrar versión de la Biblia</Label>
                <p className="text-sm text-muted-foreground">
                  Muestra la versión entre paréntesis (ej: RVR1960)
                </p>
              </div>
              <Controller
                name="showVersion"
                control={control}
                render={({ field }) => (
                  <Switch id="showVersion" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>

            {/* Mostrar número de versículo */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="showVerseNumber">Mostrar número de versículo</Label>
                <p className="text-sm text-muted-foreground">
                  Muestra el número del versículo antes del texto (ej: 16 Porque de tal manera...)
                </p>
              </div>
              <Controller
                name="showVerseNumber"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="showVerseNumber"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {watch('position') === 'upScreen' || watch('position') === 'downScreen' ? (
              <div>
                <Label htmlFor="positionStyle">Separación del borde</Label>
                <Controller
                  name="positionStyle"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[field.value || 0]}
                        max={72}
                        min={0}
                        step={1}
                        onValueChange={(value) =>
                          field.onChange(Math.min(Math.max(0, value[0] || 0), 72))
                        }
                      />
                      <div className="w-10 text-sm text-right">{field.value || 0} px</div>
                    </div>
                  )}
                />
              </div>
            ) : null}

            <Card>
              <CardHeader className="px-3 pt-0">
                <CardTitle className="text-sm">Fragmentación de versículos largos</CardTitle>
                <CardDescription className="text-xs">
                  Controla cómo se dividen automáticamente los versículos largos en múltiples partes
                  para mantener la lectura legible en live.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-0 space-y-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Longitud máxima por fragmento</p>
                  <Controller
                    name="chunkMaxLength"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || 'auto'}
                        onValueChange={(value) => field.onChange(value)}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Selecciona un modo" />
                        </SelectTrigger>
                        <SelectContent>
                          {BIBLE_LIVE_SPLIT_MODE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {CHUNK_MODE_LABELS[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {watch('chunkMaxLength') === 'auto' || !watch('chunkMaxLength')
                    ? `Auto actual: aprox. ${resolveBibleChunkMaxLength('auto', 72)} caracteres con una fuente base de 72px; aumenta o reduce según el tamaño de fuente real del tema.`
                    : `Modo fijo activo: cada fragmento intentará mantenerse cerca de ${resolveBibleChunkMaxLength(watch('chunkMaxLength') as BibleLiveSplitMode)} caracteres, respetando palabras completas y puntuación cercana.`}
                </div>
              </CardContent>
            </Card>

            {totalChunks > 1 ? (
              <p className="text-xs text-muted-foreground px-1">
                Se dividirá en {totalChunks} fragmentos (diapositivas).
              </p>
            ) : (
              <p className="text-xs text-muted-foreground px-1">
                El texto cabe completo en un solo fragmento.
              </p>
            )}
            <div className="p-4 flex items-center justify-center bg-muted rounded-md border">
              <PresentationView
                theme={{
                  ...(customTheme || selectedTheme),
                  biblePresentationSettings: {
                    ...values,
                    chunkMaxLength: values.chunkMaxLength || 'auto',
                    id: -1,
                    isGlobal: true,
                    defaultTheme: null,
                    updatedAt: new Date()
                  },
                  useDefaultBibleSettings: false
                }}
                customAspectRatio="16 / 9"
                items={[
                  {
                    text: previewText,
                    verse: {
                      bookId: 58,
                      chapter: 12,
                      verse: 1,
                      version: 'RVR1960'
                    },
                    resourceType: 'BIBLE'
                  }
                ]}
                maxHeight={300}
              />
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background p-3 z-10">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setOpen(false)
                if (customBibleSettings) {
                  reset(toFormValues(customBibleSettings))
                  return
                }

                if (defaultBiblePresentationSettings) {
                  reset(toFormValues(defaultBiblePresentationSettings))
                }
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
