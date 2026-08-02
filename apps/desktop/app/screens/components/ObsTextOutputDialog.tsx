import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Copy, ImageIcon, Trash2, Video } from 'lucide-react'
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
import { Label } from '@/ui/label'
import { Slider } from '@/ui/slider'
import { ColorPicker } from '@/ui/colorPicker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Textarea } from '@/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { MediaPicker, type Media } from '@/screens/panels/library/media/exports'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { Api } from '@ecclesia/queries'

const OBS_CONFIG_KEY = 'OBS_TEXT_OVERLAY_CONFIG'

// Forma del overlay (espejo estructural de ObsOverlayConfig del backend;
// no se importa el .ts de api/src para respetar la separación renderer/api).
type ObsOverlayConfig = {
  enabled: boolean
  textColor: string
  transparentBackground: boolean
  backgroundColor: string
  backgroundOpacity: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  position: 'top' | 'center' | 'bottom'
  horizontalAlign: 'left' | 'center' | 'right'
  textAlign: 'left' | 'center' | 'right'
  paddingX: number
  paddingY: number
  maxWidth: number
  textShadow: boolean
  uppercase: boolean
  textBorder: boolean
  textBorderColor: string
  textBorderWidth: number
  showReference: boolean
  referencePosition: 'above' | 'below'
  referenceColor: string
  referenceFontScale: number
  backgroundMediaId: number | null
  customCss: string
}

const DEFAULT_OBS_CONFIG: ObsOverlayConfig = {
  enabled: false,
  textColor: '#ffffff',
  transparentBackground: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0.55,
  fontFamily: 'Arial, sans-serif',
  fontSize: 48,
  fontWeight: 700,
  position: 'bottom',
  horizontalAlign: 'center',
  textAlign: 'center',
  paddingX: 32,
  paddingY: 20,
  maxWidth: 90,
  textShadow: true,
  uppercase: false,
  textBorder: false,
  textBorderColor: '#000000',
  textBorderWidth: 2,
  showReference: true,
  referencePosition: 'below',
  referenceColor: '#ffd54a',
  referenceFontScale: 0.9,
  backgroundMediaId: null,
  customCss: ''
}

const FONT_FAMILIES = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: '"Courier New", monospace', label: 'Courier New' }
]

const FONT_WEIGHTS = [
  { value: '400', label: 'Normal' },
  { value: '600', label: 'Semi-negrita' },
  { value: '700', label: 'Negrita' },
  { value: '900', label: 'Extra-negrita' }
]

const PREVIEW_TEXT = 'Porque de tal manera amó Dios al mundo,\nque ha dado a su Hijo unigénito'
const PREVIEW_REFERENCE = 'Juan 3:16'

function parseStoredConfig(value: string | undefined | null): ObsOverlayConfig {
  if (!value) return DEFAULT_OBS_CONFIG
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object') return { ...DEFAULT_OBS_CONFIG, ...parsed }
  } catch {
    // Ignorar y usar defaults
  }
  return DEFAULT_OBS_CONFIG
}

function hexToRgba(hex: string, opacity: number): string {
  let h = String(hex || '#000000').replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const num = parseInt(h, 16)
  if (Number.isNaN(num)) return `rgba(0,0,0,${opacity})`
  return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${opacity})`
}

// Traduce la configuración a su CSS equivalente (lo que aplica la página /obs).
// Solo referencia/lectura: el usuario puede copiarlo al cuadro de CSS personalizado.
function buildGeneratedCss(config: ObsOverlayConfig, backgroundImageUrl: string | null): string {
  const vh = (px: number) => `${((px / 1080) * 100).toFixed(2)}vh`
  const tint = hexToRgba(config.backgroundColor, config.backgroundOpacity)
  const background = config.transparentBackground
    ? 'transparent'
    : backgroundImageUrl
      ? `linear-gradient(${tint}, ${tint}), url("${backgroundImageUrl}") center / cover`
      : tint
  const justify = config.position === 'top' ? 'flex-start' : config.position === 'center' ? 'center' : 'flex-end'
  const halign = config.horizontalAlign === 'left' ? 'flex-start' : config.horizontalAlign === 'right' ? 'flex-end' : 'center'
  const boxAlign = config.textAlign === 'left' ? 'flex-start' : config.textAlign === 'right' ? 'flex-end' : 'center'

  const out: string[] = []
  out.push('#stage {')
  out.push(`  justify-content: ${justify};`)
  out.push(`  align-items: ${halign};`)
  out.push('}')
  out.push('#box {')
  out.push(`  background: ${background};`)
  out.push(`  color: ${config.textColor};`)
  out.push(`  font-family: ${config.fontFamily};`)
  out.push(`  font-size: ${vh(config.fontSize)};`)
  out.push(`  font-weight: ${config.fontWeight};`)
  out.push(`  text-align: ${config.textAlign};`)
  out.push(`  align-items: ${boxAlign};`)
  out.push(`  flex-direction: ${config.referencePosition === 'above' ? 'column-reverse' : 'column'};`)
  out.push(`  padding: ${vh(config.paddingY)} ${vh(config.paddingX)};`)
  out.push(`  max-width: ${config.maxWidth}%;`)
  out.push(`  text-transform: ${config.uppercase ? 'uppercase' : 'none'};`)
  if (config.textShadow) out.push('  text-shadow: 0 0.2vh 0.6vh rgba(0,0,0,0.85);')
  out.push('}')
  if (config.textBorder && config.textBorderWidth > 0) {
    out.push('#text, #reference {')
    out.push(`  -webkit-text-stroke: ${config.textBorderWidth}px ${config.textBorderColor};`)
    out.push('  paint-order: stroke fill;')
    out.push('}')
  }
  if (config.showReference) {
    out.push('#reference {')
    out.push(`  color: ${config.referenceColor};`)
    out.push(`  font-size: ${vh(config.fontSize * config.referenceFontScale)};`)
    out.push('}')
  }
  return out.join('\n')
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ObsTextOutputDialog({ open, onOpenChange }: Props) {
  const { port, buildMediaUrl } = useMediaServer()
  const [config, setConfig] = useState<ObsOverlayConfig>(DEFAULT_OBS_CONFIG)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [cssCopied, setCssCopied] = useState(false)
  const seededForOpenRef = useRef(false)

  const { data: settings } = useQuery({
    ...Api.query.settings.getSettings({ body: { settings: [OBS_CONFIG_KEY] } }),
    staleTime: Infinity
  })

  // Re-sembrar el formulario desde los settings cada vez que se abre el diálogo.
  if (open && !seededForOpenRef.current && settings) {
    seededForOpenRef.current = true
    setConfig(parseStoredConfig(settings.find((s) => s.key === OBS_CONFIG_KEY)?.value))
  }
  if (!open && seededForOpenRef.current) {
    seededForOpenRef.current = false
  }

  const { data: interfaces } = useQuery({
    queryKey: ['obs-lan-interfaces', port],
    enabled: open && port !== null,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(`http://localhost:${port}/api/remote/interfaces`)
      return (await res.json()) as { port: number; addresses: string[] }
    }
  })

  const { data: bgMedia } = useQuery({
    ...Api.query.media.getMediaByIds({ body: { ids: [config.backgroundMediaId!] } }),
    enabled: config.backgroundMediaId !== null,
    staleTime: Infinity
  })

  const bgMediaItem = bgMedia?.[0] ?? null
  const bgIsVideo = bgMediaItem?.type === 'VIDEO'
  const backgroundMediaUrl = bgMediaItem ? buildMediaUrl(bgMediaItem.filePath) : null
  const backgroundImageUrl = bgMediaItem && !bgIsVideo ? backgroundMediaUrl : null
  const backgroundVideoUrl = bgIsVideo ? backgroundMediaUrl : null

  const { mutateAsync: saveSettings, isPending } = useMutation({
    ...Api.mutation.settings.updateSettings
  })

  // Usar la IP de la LAN (para poder conectarse desde otra PC); localhost como fallback.
  const serverHost = interfaces?.addresses?.[0] ?? 'localhost'
  const obsUrl = port ? `http://${serverHost}:${port}/obs` : ''
  const generatedCss = buildGeneratedCss(config, backgroundImageUrl)

  const update = <K extends keyof ObsOverlayConfig>(key: K, value: ObsOverlayConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    await saveSettings({ body: { settings: [{ key: OBS_CONFIG_KEY, value: JSON.stringify(config) }] } })
    Api.socket.emit.obsConfigUpdate(config)
    onOpenChange(false)
  }

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const handleCopyCss = async () => {
    await navigator.clipboard.writeText(generatedCss)
    setCssCopied(true)
    window.setTimeout(() => setCssCopied(false), 1500)
  }

  const handleSelectMedia = (media: Media) => {
    update('backgroundMediaId', media.id)
    setIsPickerOpen(false)
  }

  // No permitir cerrar el diálogo mientras el selector de medios está abierto
  // (el picker es otro diálogo en un portal aparte y provoca cierres «fantasma»).
  const handleOpenChange = (next: boolean) => {
    if (!next && isPickerOpen) return
    onOpenChange(next)
  }

  // ¿La interacción externa proviene de otro diálogo (el MediaPicker)? En ese caso
  // no debe cerrar este diálogo. Es independiente del timing de isPickerOpen.
  const isFromOtherDialog = (e: { target?: EventTarget | null; detail?: unknown }) => {
    const original = (e.detail as { originalEvent?: Event } | undefined)?.originalEvent
    const target = (original?.target ?? e.target) as HTMLElement | null
    return isPickerOpen || !!target?.closest?.('[role="dialog"]')
  }

  // Vista previa a escala real: usa unidades cqh (relativas a la altura del
  // contenedor #stage), igual que la página /obs usa vh sobre el lienzo.
  const cqh = (px: number) => `${((px / 1080) * 100).toFixed(3)}cqh`
  const previewTint = hexToRgba(config.backgroundColor, config.backgroundOpacity)
  const previewBoxBackground = config.transparentBackground
    ? 'transparent'
    : backgroundVideoUrl
      ? 'transparent'
      : backgroundImageUrl
        ? `linear-gradient(${previewTint}, ${previewTint}), url("${backgroundImageUrl}") center / cover`
        : previewTint
  const previewStroke =
    config.textBorder && config.textBorderWidth > 0
      ? `${cqh(config.textBorderWidth)} ${config.textBorderColor}`
      : undefined

  const preview = (
    <div className="flex min-h-0 flex-1 flex-col">
      <Label className="text-xs text-muted-foreground">Vista previa</Label>
      <div
        id="stage"
        className="mt-1.5 aspect-video w-full overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#0000_0deg_90deg,#00000010_90deg_180deg)] bg-size-[20px_20px] flex flex-col"
        style={{
          containerType: 'size',
          justifyContent: config.position === 'top' ? 'flex-start' : config.position === 'center' ? 'center' : 'flex-end',
          alignItems: config.horizontalAlign === 'left' ? 'flex-start' : config.horizontalAlign === 'right' ? 'flex-end' : 'center'
        }}
      >
        {config.customCss ? <style>{config.customCss}</style> : null}
        <div
          id="box"
          className="relative flex overflow-hidden"
          style={{
            background: previewBoxBackground,
            flexDirection: config.referencePosition === 'above' ? 'column-reverse' : 'column',
            alignItems: config.textAlign === 'left' ? 'flex-start' : config.textAlign === 'right' ? 'flex-end' : 'center',
            color: config.textColor,
            fontFamily: config.fontFamily,
            fontSize: cqh(config.fontSize),
            fontWeight: config.fontWeight,
            textAlign: config.textAlign,
            padding: `${cqh(config.paddingY)} ${cqh(config.paddingX)}`,
            maxWidth: `${config.maxWidth}%`,
            textTransform: config.uppercase ? 'uppercase' : 'none',
            textShadow: config.textShadow ? '0 0.2cqh 0.6cqh rgba(0,0,0,0.85)' : 'none',
            borderRadius: '0.4cqh',
            lineHeight: 1.25
          }}
        >
          {!config.transparentBackground && backgroundVideoUrl && (
            <>
              <video
                src={backgroundVideoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
                style={{ zIndex: 0 }}
              />
              <div className="absolute inset-0" style={{ background: previewTint, zIndex: 1 }} />
            </>
          )}
          <span
            id="text"
            className="relative whitespace-pre-wrap"
            style={{ zIndex: 2, WebkitTextStroke: previewStroke, paintOrder: 'stroke fill' }}
          >
            {PREVIEW_TEXT}
          </span>
          {config.showReference && (
            <span
              id="reference"
              className="relative"
              style={{
                zIndex: 2,
                color: config.referenceColor,
                fontSize: cqh(config.fontSize * config.referenceFontScale),
                marginTop: config.referencePosition === 'above' ? 0 : '0.4cqh',
                marginBottom: config.referencePosition === 'above' ? '0.4cqh' : 0,
                WebkitTextStroke: previewStroke,
                paintOrder: 'stroke fill'
              }}
            >
              {PREVIEW_REFERENCE}
            </span>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Vista previa a escala real (16:9). En OBS el tamaño se ajusta al «Browser Source».
      </p>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
        onPointerDownOutside={(e) => {
          if (isFromOtherDialog(e)) e.preventDefault()
        }}
        onFocusOutside={(e) => {
          if (isFromOtherDialog(e)) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (isFromOtherDialog(e)) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (isPickerOpen) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Salida de texto para OBS</DialogTitle>
          <DialogDescription>
            Expone el texto que se presenta en vivo (canciones, versículos, presentaciones) como
            subtítulos para superponer en OBS. Se omiten imágenes, vídeos y la cuenta atrás.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 md:flex-row flex-1 min-h-0 -mx-6 px-6 overflow-y-auto md:overflow-hidden">
          {/* Controles en pestañas: izquierda */}
          <div className="md:w-96 md:shrink-0 flex flex-col md:min-h-0">
            <Tabs defaultValue="general" className="flex flex-1 flex-col md:min-h-0">
              <TabsList className="grid w-full grid-cols-5 shrink-0">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="texto">Texto</TabsTrigger>
                <TabsTrigger value="fondo">Fondo</TabsTrigger>
                <TabsTrigger value="versiculo">Versículo</TabsTrigger>
                <TabsTrigger value="css">CSS</TabsTrigger>
              </TabsList>

              <div className="mt-3 md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1">
                {/* GENERAL */}
                <TabsContent value="general" className="mt-0 space-y-5">
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="obs-enabled" className="font-medium">
                          Activar salida de subtítulos
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cuando está desactivada, la página no muestra ningún texto.
                        </p>
                      </div>
                      <Switch
                        id="obs-enabled"
                        checked={config.enabled}
                        onCheckedChange={(v) => update('enabled', v)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        URL para «Browser Source» en OBS
                      </Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-sm">
                          {obsUrl || '—'}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyUrl(obsUrl)}
                          disabled={!obsUrl}
                        >
                          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                        </Button>
                      </div>
                      {interfaces && interfaces.addresses.length > 1 && (
                        <p className="text-xs text-muted-foreground">
                          Otras direcciones de red:{' '}
                          {interfaces.addresses.slice(1).map((ip) => (
                            <code key={ip} className="mr-2">
                              http://{ip}:{interfaces.port}/obs
                            </code>
                          ))}
                        </p>
                      )}
                      {interfaces && interfaces.addresses.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No se detectó IP de red; solo accesible desde este equipo (localhost).
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 *:flex-1 *:min-w-0">
                    <Field label="Posición vertical">
                      <Select value={config.position} onValueChange={(v) => update('position', v as ObsOverlayConfig['position'])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Arriba</SelectItem>
                          <SelectItem value="center">Centro</SelectItem>
                          <SelectItem value="bottom">Abajo</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Posición horizontal">
                      <Select value={config.horizontalAlign} onValueChange={(v) => update('horizontalAlign', v as ObsOverlayConfig['horizontalAlign'])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Izquierda</SelectItem>
                          <SelectItem value="center">Centro</SelectItem>
                          <SelectItem value="right">Derecha</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Alineación del texto">
                    <Select value={config.textAlign} onValueChange={(v) => update('textAlign', v as ObsOverlayConfig['textAlign'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Izquierda</SelectItem>
                        <SelectItem value="center">Centro</SelectItem>
                        <SelectItem value="right">Derecha</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <SliderField
                    label={`Ancho máximo: ${config.maxWidth}%`}
                    value={config.maxWidth}
                    min={20}
                    max={100}
                    step={1}
                    onChange={(v) => update('maxWidth', v)}
                  />
                  <SliderField
                    label={`Relleno horizontal: ${config.paddingX}px`}
                    value={config.paddingX}
                    min={0}
                    max={160}
                    step={2}
                    onChange={(v) => update('paddingX', v)}
                  />
                  <SliderField
                    label={`Relleno vertical: ${config.paddingY}px`}
                    value={config.paddingY}
                    min={0}
                    max={160}
                    step={2}
                    onChange={(v) => update('paddingY', v)}
                  />
                </TabsContent>

                {/* TEXTO */}
                <TabsContent value="texto" className="mt-0 space-y-5">
                  <Field label="Fuente">
                    <Select value={config.fontFamily} onValueChange={(v) => update('fontFamily', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONT_FAMILIES.map((f) => (
                          <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Grosor">
                    <Select value={String(config.fontWeight)} onValueChange={(v) => update('fontWeight', Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONT_WEIGHTS.map((w) => (
                          <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <SliderField
                    label={`Tamaño de fuente: ${config.fontSize}px`}
                    value={config.fontSize}
                    min={16}
                    max={140}
                    step={1}
                    onChange={(v) => update('fontSize', v)}
                  />

                  <Field label="Color del texto">
                    <div className="flex items-center gap-3">
                      <ColorPicker value={config.textColor} onChange={(c) => update('textColor', c)} />
                      <span className="text-sm font-mono text-muted-foreground">{config.textColor}</span>
                    </div>
                  </Field>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={config.textShadow} onCheckedChange={(v) => update('textShadow', v)} />
                      Sombra
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={config.uppercase} onCheckedChange={(v) => update('uppercase', v)} />
                      Mayúsculas
                    </label>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium">Borde del texto (contorno)</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Contorno alrededor de las letras para dar contraste sin usar fondo.
                        </p>
                      </div>
                      <Switch checked={config.textBorder} onCheckedChange={(v) => update('textBorder', v)} />
                    </div>
                    {config.textBorder && (
                      <div className="space-y-4 pt-1">
                        <Field label="Color del borde">
                          <div className="flex items-center gap-3">
                            <ColorPicker value={config.textBorderColor} onChange={(c) => update('textBorderColor', c)} />
                            <span className="text-sm font-mono text-muted-foreground">{config.textBorderColor}</span>
                          </div>
                        </Field>
                        <SliderField
                          label={`Grosor del borde: ${config.textBorderWidth}px`}
                          value={config.textBorderWidth}
                          min={0}
                          max={12}
                          step={1}
                          onChange={(v) => update('textBorderWidth', v)}
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* FONDO */}
                <TabsContent value="fondo" className="mt-0 space-y-5">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label className="font-medium">Fondo transparente</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Recuadro sin fondo (solo texto). Ignora color e imagen/vídeo.
                      </p>
                    </div>
                    <Switch
                      checked={config.transparentBackground}
                      onCheckedChange={(v) => update('transparentBackground', v)}
                    />
                  </div>

                  <Field label="Color de fondo">
                    <div className="flex items-center gap-3">
                      <ColorPicker value={config.backgroundColor} onChange={(c) => update('backgroundColor', c)} />
                      <span className="text-sm font-mono text-muted-foreground">{config.backgroundColor}</span>
                    </div>
                  </Field>

                  <SliderField
                    label={`Opacidad del fondo: ${Math.round(config.backgroundOpacity * 100)}%`}
                    value={Math.round(config.backgroundOpacity * 100)}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => update('backgroundOpacity', v / 100)}
                  />

                  <Field label="Imagen o vídeo de fondo (opcional)">
                    <div className="flex items-center gap-3">
                      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md border bg-muted/40 flex items-center justify-center">
                        {backgroundVideoUrl ? (
                          <>
                            <video src={backgroundVideoUrl} muted className="h-full w-full object-cover" />
                            <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5">
                              <Video className="size-3 text-white" />
                            </div>
                          </>
                        ) : backgroundImageUrl ? (
                          <img src={backgroundImageUrl} alt="Fondo" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="size-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsPickerOpen(true)}>
                          {config.backgroundMediaId ? 'Cambiar' : 'Seleccionar'}
                        </Button>
                        {config.backgroundMediaId !== null && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => update('backgroundMediaId', null)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El vídeo se reproduce en bucle detrás del texto, con el color de fondo como tinte.
                    </p>
                  </Field>
                </TabsContent>

                {/* VERSÍCULO */}
                <TabsContent value="versiculo" className="mt-0 space-y-5">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label className="font-medium">Indicador de versículo</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Muestra la referencia (ej. «Juan 3:16») en contenido bíblico, con estilo propio.
                      </p>
                    </div>
                    <Switch checked={config.showReference} onCheckedChange={(v) => update('showReference', v)} />
                  </div>

                  {config.showReference && (
                    <>
                      <Field label="Posición del indicador">
                        <Select value={config.referencePosition} onValueChange={(v) => update('referencePosition', v as ObsOverlayConfig['referencePosition'])}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="above">Encima del texto</SelectItem>
                            <SelectItem value="below">Debajo del texto</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Color del indicador">
                        <div className="flex items-center gap-3">
                          <ColorPicker value={config.referenceColor} onChange={(c) => update('referenceColor', c)} />
                          <span className="text-sm font-mono text-muted-foreground">{config.referenceColor}</span>
                        </div>
                      </Field>
                      <SliderField
                        label={`Tamaño del indicador: ${Math.round(config.referenceFontScale * 100)}% del texto`}
                        value={Math.round(config.referenceFontScale * 100)}
                        min={20}
                        max={100}
                        step={5}
                        onChange={(v) => update('referenceFontScale', v / 100)}
                      />
                    </>
                  )}
                </TabsContent>

                {/* CSS */}
                <TabsContent value="css" className="mt-0 space-y-5">
                  <Field label="CSS de la configuración (referencia)">
                    <p className="-mt-1 text-xs text-muted-foreground">
                      Refleja en CSS las opciones seleccionadas (lo que aplica la página). Solo
                      lectura: cópialo como punto de partida en el CSS personalizado.
                    </p>
                    <div className="relative">
                      <pre className="max-h-52 overflow-auto rounded-md border bg-muted/40 p-3 pr-12 font-mono text-xs leading-relaxed">
                        {generatedCss}
                      </pre>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="absolute right-2 top-2"
                        onClick={handleCopyCss}
                      >
                        {cssCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      </Button>
                    </div>
                  </Field>

                  <Field label="CSS personalizado (avanzado)">
                    <p className="-mt-1 text-xs text-muted-foreground">
                      Se inyecta en la página. Apunta a <code>#stage</code>, <code>#box</code>,{' '}
                      <code>#text</code> y <code>#reference</code>, controla la posición (ej.{' '}
                      <code>#stage {'{'} align-items: flex-end {'}'}</code>) e incluso define{' '}
                      <code>@keyframes</code>. Usa <code>!important</code> para sobrescribir los estilos base.
                    </p>
                    <Textarea
                      value={config.customCss}
                      onChange={(e) => update('customCss', e.target.value)}
                      placeholder={'#box {\n  border: 2px solid gold !important;\n  border-radius: 12px !important;\n}\n#reference {\n  letter-spacing: 2px !important;\n  text-transform: uppercase !important;\n}'}
                      className="font-mono text-xs min-h-32"
                      spellCheck={false}
                    />
                  </Field>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Vista previa: a la derecha en pantallas anchas */}
          <div className="md:flex-1 md:min-w-0 flex">{preview}</div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>

      <MediaPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handleSelectMedia}
        title="Seleccionar imagen o vídeo de fondo del overlay"
      />
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  )
}
