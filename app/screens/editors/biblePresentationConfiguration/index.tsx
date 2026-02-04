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
import { PropsWithChildren, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { BiblePresentationSchema } from './schema'
import { Tooltip } from '@/ui/tooltip'
import {
  BibleDescriptionMode,
  BibleDescriptionPosition,
  BiblePresentationSettings
} from '@prisma/client'
import { PresentationView } from '../../../ui/PresentationView'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useDefaultBiblePresentationSettings } from '@/hooks/useDefaultBiblePresentationSettings'
import { Slider } from '@/ui/slider'
import { ThemeWithMedia } from '../../../ui/PresentationView/types'

type Props = {
  hideTooltip?: boolean
  customTheme?: ThemeWithMedia
  customBibleSettings?: Omit<BiblePresentationSettings, 'id' | 'isGlobal' | 'defaultTheme'> & {
    id?: number
  }
  setCustomBibleSettings?: (value: BiblePresentationSettings) => void
} & PropsWithChildren

export default function BiblePresentationConfiguration({
  children,
  hideTooltip,
  customTheme,
  customBibleSettings,
  setCustomBibleSettings
}: Props) {
  const { selectedTheme } = useSchedule()
  const [open, setOpen] = useState(false)
  const { defaultBiblePresentationSettings } = useDefaultBiblePresentationSettings()
  const { control, handleSubmit, watch, reset } = useForm({
    defaultValues: {
      description: 'complete' as BibleDescriptionMode,
      position: 'afterText' as BibleDescriptionPosition,
      showVersion: true,
      showVerseNumber: false,
      positionStyle: null,
      ...customBibleSettings
    },
    resolver: zodResolver(BiblePresentationSchema)
  })

  const values = watch()

  const onSubmit = (data: any) => {
    if (customBibleSettings && setCustomBibleSettings) {
      setCustomBibleSettings(data)
      setOpen(false)
      return
    }
    console.log('Guardar configuración:', data)
    // Aquí implementar la lógica para guardar
  }

  const loadGlobalSettings = () => {
    if (defaultBiblePresentationSettings) {
      reset(defaultBiblePresentationSettings)
    }
  }

  useEffect(() => loadGlobalSettings(), [defaultBiblePresentationSettings])

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configuración de presentación de Biblia</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-2 mb-4">
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
                <Label htmlFor="positionStyle">Altura en la pantalla</Label>
                <Controller
                  name="positionStyle"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[field.value || 0]}
                        max={16}
                        min={0}
                        onValueChange={(value) => field.onChange(value[0])}
                      />
                      <div className="w-10 text-sm text-right">{field.value || 0} px</div>
                    </div>
                  )}
                />
              </div>
            ) : null}

            <div className="p-4 flex items-center justify-center bg-muted rounded-md border">
              <PresentationView
                theme={{
                  ...(customTheme || selectedTheme),
                  biblePresentationSettings: {
                    ...values,
                    id: -1,
                    isGlobal: true,
                    defaultTheme: null
                  },
                  useDefaultBibleSettings: false
                }}
                items={[
                  {
                    text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
                    verse: {
                      bookId: 43,
                      chapter: 3,
                      verse: 16,
                      version: 'RVR1960'
                    }
                  }
                ]}
                maxHeight={220}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setOpen(false)
                setTimeout(() => {
                  loadGlobalSettings()
                }, 500)
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
