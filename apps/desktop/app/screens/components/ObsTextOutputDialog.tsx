import { useRef, useState } from 'react'
import { useResizeObserver } from 'usehooks-ts'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Copy, ImageIcon, Plus, Trash2, Video } from 'lucide-react'
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
import { Slider } from '@/ui/slider'
import { ColorPicker } from '@/ui/colorPicker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Textarea } from '@/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { MediaPicker, type Media } from '@/screens/panels/library/media/exports'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { cn } from '@/lib/utils'
import { Api } from '@ecclesia/queries'
import fondoObs from '@/assets/fondo-obs.jpg'

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
  offsetX: number
  offsetY: number
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
  offsetX: 0,
  offsetY: 0,
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

type ObsContentType = 'SONG' | 'BIBLE' | 'PRESENTATION'
type ObsSubtitle = ObsOverlayConfig & { slug: string; name: string; types: ObsContentType[] }

const SUBTITLES_KEY = 'OBS_SUBTITLES'
const CONTENT_TYPES: { value: ObsContentType; label: string }[] = [
  { value: 'BIBLE', label: 'Biblia' },
  { value: 'SONG', label: 'Canción' },
  { value: 'PRESENTATION', label: 'Presentación' }
]

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function makeSubtitle(slug: string, name: string): ObsSubtitle {
  return { ...DEFAULT_OBS_CONFIG, enabled: true, slug, name, types: [] }
}

function parseSubtitles(value: string | undefined | null): ObsSubtitle[] {
  if (!value) return []
  let arr: unknown = []
  try {
    arr = JSON.parse(value)
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []
  const seen = new Set<string>()
  const out: ObsSubtitle[] = []
  arr.forEach((item, i) => {
    if (!item || typeof item !== 'object') return
    const rec = item as Record<string, unknown>
    const slug = slugify(typeof rec.slug === 'string' ? rec.slug : '') || `text-${i + 1}`
    if (seen.has(slug)) return
    seen.add(slug)
    const types = Array.isArray(rec.types)
      ? (rec.types.filter((t) => t === 'SONG' || t === 'BIBLE' || t === 'PRESENTATION') as ObsContentType[])
      : []
    const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name : slug
    out.push({ ...DEFAULT_OBS_CONFIG, ...(rec as Partial<ObsOverlayConfig>), slug, name, types })
  })
  return out
}

function nextFreeSlug(subtitles: ObsSubtitle[]): string {
  let n = subtitles.length + 1
  const taken = new Set(subtitles.map((s) => s.slug))
  while (taken.has(`text-${n}`)) n++
  return `text-${n}`
}

function hexToRgba(hex: string, opacity: number): string {
  let h = String(hex || '#000000').replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const num = parseInt(h, 16)
  if (Number.isNaN(num)) return `rgba(0,0,0,${opacity})`
  return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${opacity})`
}

// Genera la hoja de estilos BASE del editor (reglas por id #stage/#box/#text/#reference).
// Es la misma que aplica la página /obs; se inyecta ANTES del CSS del usuario para que este
// gane por cascada SIN `!important`. `unit` = 'vh' para la página real / 'cqh' para el preview
// (relativo al contenedor). Se usa también, con 'vh', en el panel de «CSS de la configuración».
// Lienzo virtual compartido con la página /obs: 1080px de alto, el mismo al que
// están referidos todos los valores del editor.
const PREVIEW_STAGE_WIDTH = 1920
const PREVIEW_STAGE_HEIGHT = 1080
/** Equivale al `4vh` que tenía el #stage antes de pasar a px. */
const PREVIEW_STAGE_PADDING_Y = 43.2

export function buildGeneratedCss(
  config: ObsOverlayConfig,
  opts: { backgroundImageUrl?: string | null; hasVideo?: boolean } = {}
): string {
  // Tanto el preview como la página /obs montan un lienzo virtual de 1080px de
  // alto y lo escalan, así que los valores del editor se emiten como px
  // literales: no hay conversión que pueda divergir entre las dos superficies.
  const len = (px: number) => `${px}px`
  const lenX = len
  const tint = hexToRgba(config.backgroundColor, config.backgroundOpacity)
  const refAbove = config.referencePosition === 'above'
  const mTop = config.position === 'top' ? len(config.offsetY) : '0'
  const mBottom = config.position === 'bottom' ? len(config.offsetY) : '0'
  const mLeft = config.horizontalAlign === 'left' ? lenX(config.offsetX) : '0'
  const mRight = config.horizontalAlign === 'right' ? lenX(config.offsetX) : '0'
  const background =
    config.transparentBackground || opts.hasVideo
      ? 'transparent'
      : opts.backgroundImageUrl
        ? `linear-gradient(${tint}, ${tint}), url("${opts.backgroundImageUrl}") center / cover`
        : tint
  const justify = config.position === 'top' ? 'flex-start' : config.position === 'center' ? 'center' : 'flex-end'
  const halign = config.horizontalAlign === 'left' ? 'flex-start' : config.horizontalAlign === 'right' ? 'flex-end' : 'center'
  const boxAlign = config.textAlign === 'left' ? 'flex-start' : config.textAlign === 'right' ? 'flex-end' : 'center'

  const out: string[] = []
  out.push(`#stage {\n  justify-content: ${justify};\n  align-items: ${halign};\n}`)
  out.push('#box {')
  out.push(`  flex-direction: ${refAbove ? 'column-reverse' : 'column'};`)
  out.push(`  align-items: ${boxAlign};`)
  out.push(`  background: ${background};`)
  out.push(`  color: ${config.textColor};`)
  out.push(`  font-family: ${config.fontFamily};`)
  out.push(`  font-size: ${len(config.fontSize)};`)
  out.push(`  font-weight: ${config.fontWeight};`)
  out.push(`  text-align: ${config.textAlign};`)
  out.push(`  padding: ${len(config.paddingY)} ${len(config.paddingX)};`)
  out.push(`  max-width: ${config.maxWidth}%;`)
  out.push(`  margin: ${mTop} ${mRight} ${mBottom} ${mLeft};`)
  out.push('  line-height: 1.25;')
  out.push(`  border-radius: ${len(4)};`)
  out.push(`  text-transform: ${config.uppercase ? 'uppercase' : 'none'};`)
  if (config.textShadow) out.push('  text-shadow: 0 2px 6px rgba(0,0,0,0.85);')
  out.push('}')
  out.push(
    `#reference {\n  color: ${config.referenceColor};\n  font-size: ${len(config.fontSize * config.referenceFontScale)};\n  margin: ${refAbove ? '0 0 0.4em' : '0.4em 0 0'};\n}`
  )
  if (config.textBorder && config.textBorderWidth > 0) {
    out.push(
      `#text, #reference {\n  -webkit-text-stroke: ${len(config.textBorderWidth)} ${config.textBorderColor};\n  paint-order: stroke fill;\n}`
    )
  }
  return out.join('\n')
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ObsTextOutputDialog({ open, onOpenChange }: Props) {
  const { port, buildMediaUrl } = useMediaServer()
  const [subtitles, setSubtitles] = useState<ObsSubtitle[]>([makeSubtitle('text-1', 'Subtítulo 1')])
  const [activeSlug, setActiveSlug] = useState('text-1')
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [cssCopied, setCssCopied] = useState(false)
  const seededForOpenRef = useRef(false)

  const { data: settings } = useQuery({
    ...Api.query.settings.getSettings({ body: { settings: [SUBTITLES_KEY, OBS_CONFIG_KEY] } }),
    staleTime: Infinity
  })

  // Re-sembrar la lista desde settings cada vez que se abre el diálogo.
  if (open && !seededForOpenRef.current && settings) {
    seededForOpenRef.current = true
    let list = parseSubtitles(settings.find((s) => s.key === SUBTITLES_KEY)?.value)
    if (list.length === 0) {
      // Migrar el overlay único antiguo (si existe) como primer subtítulo.
      const legacy = parseStoredConfig(settings.find((s) => s.key === OBS_CONFIG_KEY)?.value)
      list = [{ ...legacy, slug: 'text-1', name: 'Subtítulo 1', types: [] }]
    }
    setSubtitles(list)
    setActiveSlug(list[0].slug)
  }
  if (!open && seededForOpenRef.current) {
    seededForOpenRef.current = false
  }

  const config =
    subtitles.find((s) => s.slug === activeSlug) ?? subtitles[0] ?? makeSubtitle('text-1', 'Subtítulo 1')

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
  const obsUrl = port ? `http://${serverHost}:${port}/obs/subtitle/${config.slug}` : ''
  // Una sola hoja: el preview y la página /obs comparten lienzo virtual, así que
  // el CSS que se muestra en el panel es literalmente el que se aplica en OBS.
  const generatedCss = buildGeneratedCss(config, {
    backgroundImageUrl,
    hasVideo: !!backgroundVideoUrl
  })
  const previewCss = generatedCss

  const update = <K extends keyof ObsOverlayConfig>(key: K, value: ObsOverlayConfig[K]) =>
    setSubtitles((prev) => prev.map((s) => (s.slug === activeSlug ? { ...s, [key]: value } : s)))

  const updateName = (name: string) =>
    setSubtitles((prev) => prev.map((s) => (s.slug === activeSlug ? { ...s, name } : s)))

  const updateSlug = (raw: string) => {
    const next = slugify(raw)
    if (!next || subtitles.some((s) => s.slug === next && s.slug !== activeSlug)) return
    setSubtitles((prev) => prev.map((s) => (s.slug === activeSlug ? { ...s, slug: next } : s)))
    setActiveSlug(next)
  }

  const toggleType = (t: ObsContentType) =>
    setSubtitles((prev) =>
      prev.map((s) =>
        s.slug === activeSlug
          ? { ...s, types: s.types.includes(t) ? s.types.filter((x) => x !== t) : [...s.types, t] }
          : s
      )
    )

  const addSubtitle = () => {
    const slug = nextFreeSlug(subtitles)
    setSubtitles((prev) => [...prev, makeSubtitle(slug, `Subtítulo ${prev.length + 1}`)])
    setActiveSlug(slug)
  }

  const removeSubtitle = (slug: string) => {
    setSubtitles((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((s) => s.slug !== slug)
      if (slug === activeSlug) setActiveSlug(next[0].slug)
      return next
    })
  }

  const handleSave = async () => {
    await saveSettings({ body: { settings: [{ key: SUBTITLES_KEY, value: JSON.stringify(subtitles) }] } })
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

  const previewViewportRef = useRef<HTMLDivElement | null>(null)
  const { width: previewWidth = 0 } = useResizeObserver({
    ref: previewViewportRef as React.RefObject<HTMLElement>,
    box: 'border-box'
  })

  const previewTint = hexToRgba(config.backgroundColor, config.backgroundOpacity)

  // Mismo montaje que la página /obs: un lienzo virtual de 1920x1080 escalado al
  // hueco disponible. Al ser px reales sobre un lienzo de tamaño conocido, todo
  // —incluido el CSS personalizado en px, rem o em— rinde igual aquí que en OBS.
  const previewScale = previewWidth > 0 ? previewWidth / PREVIEW_STAGE_WIDTH : 0

  const preview = (
    <div className="flex min-h-0 flex-1 flex-col">
      <Label className="text-xs text-muted-foreground">Vista previa</Label>
      <div
        ref={previewViewportRef}
        className="relative mt-1.5 aspect-video w-full overflow-hidden rounded-lg border bg-black"
      >
        {/* Fondo de escena difuminado (solo referencia visual del preview) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url("${fondoObs}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(6px)',
            transform: 'scale(1.1)',
            zIndex: 0
          }}
        />
        {/* Hoja base (editor) primero; el CSS del usuario después → gana sin !important */}
        <style>{previewCss}</style>
        {config.customCss ? <style>{config.customCss}</style> : null}
        <div
          id="stage"
          className="absolute left-0 top-0 flex flex-col"
          style={{
            width: PREVIEW_STAGE_WIDTH,
            height: PREVIEW_STAGE_HEIGHT,
            padding: `${PREVIEW_STAGE_PADDING_Y}px 0`,
            boxSizing: 'border-box',
            transform: `scale(${previewScale})`,
            transformOrigin: 'top left',
            visibility: previewScale > 0 ? 'visible' : 'hidden'
          }}
        >
        <div id="box" className="relative flex overflow-hidden" style={{ zIndex: 1 }}>
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
          <span id="text" className="relative whitespace-pre-wrap" style={{ zIndex: 2 }}>
            {PREVIEW_TEXT}
          </span>
          {config.showReference && (
            <span id="reference" className="relative" style={{ zIndex: 2 }}>
              {PREVIEW_REFERENCE}
            </span>
          )}
        </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Vista previa a escala real (16:9): lienzo de 1920×1080 reducido, igual que en OBS. Las
        medidas en px, rem o em del CSS personalizado se ven aquí tal cual saldrán.
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

        {/* Selector de subtítulos */}
        <div className="flex items-center gap-2 flex-wrap shrink-0 border-b pb-3">
          {subtitles.map((s) => (
            <div
              key={s.slug}
              className={`group flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${
                s.slug === activeSlug ? 'border-primary bg-primary/10' : 'hover:bg-muted'
              }`}
            >
              <button type="button" onClick={() => setActiveSlug(s.slug)} className="max-w-35 truncate">
                {s.name}
              </button>
              {subtitles.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSubtitle(s.slug)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Eliminar ${s.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSubtitle}>
            <Plus className="mr-1 size-4" /> Añadir subtítulo
          </Button>
        </div>

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
                <TabsContent value="general" className="mt-0 space-y-6">
                  {/* ── Activar ── */}
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label htmlFor="obs-enabled" className="text-sm font-medium">
                        Activar este subtítulo
                      </Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Si está apagado, su página no muestra nada en OBS.
                      </p>
                    </div>
                    <Switch
                      id="obs-enabled"
                      checked={config.enabled}
                      onCheckedChange={(v) => update('enabled', v)}
                    />
                  </div>

                  {/* ── Identidad ── */}
                  <section className="space-y-3">
                    <SectionTitle>Identidad</SectionTitle>

                    <Field label="Nombre">
                      <Input value={config.name} onChange={(e) => updateName(e.target.value)} />
                    </Field>

                    <Field label="Ruta (Browser Source)">
                      <div className="flex items-center rounded-md border bg-muted/30 pl-2 focus-within:ring-1 focus-within:ring-ring">
                        <span className="select-none font-mono text-xs text-muted-foreground">/obs/subtitle/</span>
                        <Input
                          value={config.slug}
                          onChange={(e) => updateSlug(e.target.value)}
                          placeholder="text-1"
                          className="border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0"
                        />
                      </div>
                    </Field>

                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={obsUrl}
                        placeholder="—"
                        className="flex-1 font-mono text-xs"
                        onFocus={(e) => e.currentTarget.select()}
                        aria-label="URL completa del subtítulo"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyUrl(obsUrl)}
                        disabled={!obsUrl}
                        title="Copiar URL"
                      >
                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      </Button>
                    </div>
                    {interfaces && interfaces.addresses.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Otras IPs de red:{' '}
                        {interfaces.addresses.slice(1).map((ip) => (
                          <code key={ip} className="mr-2">
                            {ip}:{interfaces.port}
                          </code>
                        ))}
                      </p>
                    )}
                    {interfaces && interfaces.addresses.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Sin IP de red; solo accesible desde este equipo (localhost).
                      </p>
                    )}
                  </section>

                  {/* ── Filtro por contenido ── */}
                  <section className="space-y-2">
                    <div>
                      <SectionTitle>Mostrar solo para</SectionTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sin selección = se muestra con cualquier contenido.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CONTENT_TYPES.map((t) => {
                        const active = config.types.includes(t.value)
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => toggleType(t.value)}
                            aria-pressed={active}
                            className={cn(
                              'rounded-full border px-3 py-1 text-sm transition-colors',
                              active
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted'
                            )}
                          >
                            {t.label}
                          </button>
                        )
                      })}
                    </div>
                  </section>

                  {/* ── Posición y tamaño ── */}
                  <section className="space-y-4">
                    <SectionTitle>Posición y tamaño</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
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
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <SliderField
                        label={`Relleno horiz.: ${config.paddingX}px`}
                        value={config.paddingX}
                        min={0}
                        max={160}
                        step={2}
                        onChange={(v) => update('paddingX', v)}
                      />
                      <SliderField
                        label={`Relleno vert.: ${config.paddingY}px`}
                        value={config.paddingY}
                        min={0}
                        max={160}
                        step={2}
                        onChange={(v) => update('paddingY', v)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <SliderField
                        label={`Separación borde vert.: ${config.offsetY}px`}
                        value={config.offsetY}
                        min={0}
                        max={400}
                        step={4}
                        onChange={(v) => update('offsetY', v)}
                        disabled={config.position === 'center'}
                      />
                      <SliderField
                        label={`Separación borde horiz.: ${config.offsetX}px`}
                        value={config.offsetX}
                        min={0}
                        max={400}
                        step={4}
                        onChange={(v) => update('offsetX', v)}
                        disabled={config.horizontalAlign === 'center'}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      La separación vertical solo aplica con posición arriba/abajo, y la horizontal
                      con izquierda/derecha.
                    </p>
                  </section>
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
                      Selectores disponibles: <code>#stage</code>, <code>#box</code>,{' '}
                      <code>#text</code>, <code>#reference</code>.
                    </p>
                    <Textarea
                      value={config.customCss}
                      onChange={(e) => update('customCss', e.target.value)}
                      placeholder={'#box {\n  border: 2px solid gold;\n  border-radius: 12px;\n}\n#reference {\n  letter-spacing: 2px;\n  text-transform: uppercase;\n}'}
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
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
  onChange,
  disabled = false
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <div className={cn('space-y-2', disabled && 'pointer-events-none opacity-50')}>
      <Label className="text-sm">{label}</Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
      />
    </div>
  )
}
