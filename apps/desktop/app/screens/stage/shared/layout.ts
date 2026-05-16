export type StageWidgetType = 'message' | 'timers' | 'clock' | 'liveTitle' | 'liveScreen'

export type StageWidgetConfig = {
  textColor?: string
  fontFamily?: string
  fontSize?: number
  timerOnTimeColor?: string
  timerWarningColor?: string
  timerOverdueColor?: string
  timerWarningThresholdSeconds?: number
  timerLabelFontSize?: number
  timerValueFontSize?: number
}

export type StageLayoutItem = {
  id: string
  type: StageWidgetType
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
  visible: boolean
  config?: StageWidgetConfig
}

export type StageLayout = {
  version: number
  items: StageLayoutItem[]
}

const createDefaultItem = (
  id: string,
  type: StageWidgetType,
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
  z: number
): StageLayoutItem => ({
  id,
  type,
  title,
  x,
  y,
  w,
  h,
  z,
  visible: true,
  config: getDefaultWidgetConfig(type)
})

export const DEFAULT_STAGE_LAYOUT: StageLayout = {
  version: 1,
  items: [
    createDefaultItem('widget-live-screen', 'liveScreen', 'Pantalla En Vivo', 4, 24, 62, 56, 5),
    createDefaultItem('widget-message', 'message', 'Mensaje', 4, 6, 58, 18, 10),
    createDefaultItem('widget-timers', 'timers', 'Timers', 70, 52, 26, 40, 20),
    createDefaultItem('widget-clock', 'clock', 'Reloj', 74, 4, 22, 10, 30),
    createDefaultItem('widget-live-title', 'liveTitle', 'Título En Vivo', 4, 86, 58, 10, 15)
  ]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const COLOR_HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

function sanitizeColor(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  return COLOR_HEX_PATTERN.test(raw) ? raw : fallback
}

function sanitizeFontFamily(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const next = value.trim()
  if (!next) return fallback
  return next.slice(0, 100)
}

function getDefaultWidgetConfig(type: StageWidgetType): StageWidgetConfig {
  if (type === 'timers') {
    return {
      fontFamily: 'monospace',
      timerLabelFontSize: 36,
      timerValueFontSize: 96,
      timerOnTimeColor: '#22d3ee',
      timerWarningColor: '#f59e0b',
      timerOverdueColor: '#ef4444',
      timerWarningThresholdSeconds: 30
    }
  }

  if (type === 'clock') {
    return {
      textColor: '#ffffff',
      fontFamily: 'monospace',
      fontSize: 96
    }
  }

  if (type === 'message' || type === 'liveTitle') {
    return {
      textColor: '#ffffff',
      fontFamily: 'inherit',
      fontSize: type === 'message' ? 64 : 56
    }
  }

  return {}
}

function sanitizeConfig(type: StageWidgetType, raw: unknown): StageWidgetConfig {
  const source = raw && typeof raw === 'object' ? (raw as StageWidgetConfig) : {}
  const fallback = getDefaultWidgetConfig(type)

  if (type === 'timers') {
    return {
      fontFamily: sanitizeFontFamily(source.fontFamily, fallback.fontFamily ?? 'monospace'),
      timerOnTimeColor: sanitizeColor(
        source.timerOnTimeColor,
        fallback.timerOnTimeColor ?? '#22d3ee'
      ),
      timerLabelFontSize: Number.isFinite(Number(source.timerLabelFontSize))
        ? clamp(Number(source.timerLabelFontSize), 12, 180)
        : (fallback.timerLabelFontSize ?? 36),
      timerValueFontSize: Number.isFinite(Number(source.timerValueFontSize))
        ? clamp(Number(source.timerValueFontSize), 16, 240)
        : (fallback.timerValueFontSize ?? 96),
      timerWarningColor: sanitizeColor(
        source.timerWarningColor,
        fallback.timerWarningColor ?? '#f59e0b'
      ),
      timerOverdueColor: sanitizeColor(
        source.timerOverdueColor,
        fallback.timerOverdueColor ?? '#ef4444'
      ),
      timerWarningThresholdSeconds: Number.isFinite(Number(source.timerWarningThresholdSeconds))
        ? clamp(Number(source.timerWarningThresholdSeconds), 0, 3600)
        : (fallback.timerWarningThresholdSeconds ?? 30)
    }
  }

  if (type === 'clock' || type === 'message' || type === 'liveTitle') {
    const rawFontSize = Number(source.fontSize)
    const minFontSize = type === 'clock' ? 20 : 16
    const maxFontSize = type === 'clock' ? 96 : 120

    return {
      textColor: sanitizeColor(source.textColor, fallback.textColor ?? '#ffffff'),
      fontFamily: sanitizeFontFamily(source.fontFamily, fallback.fontFamily ?? 'inherit'),
      fontSize: Number.isFinite(rawFontSize)
        ? clamp(rawFontSize, minFontSize, maxFontSize)
        : (fallback.fontSize ?? 64)
    }
  }

  return {}
}

const sanitizeItem = (raw: Partial<StageLayoutItem>, index: number): StageLayoutItem => {
  const fallback = DEFAULT_STAGE_LAYOUT.items[index % DEFAULT_STAGE_LAYOUT.items.length]
  const safeType: StageWidgetType =
    raw.type && ['message', 'timers', 'clock', 'liveTitle', 'liveScreen'].includes(raw.type)
      ? raw.type
      : fallback.type
  const x = Number(raw.x)
  const y = Number(raw.y)
  const w = Number(raw.w)
  const h = Number(raw.h)
  const z = Number(raw.z)

  return {
    id: raw.id && raw.id.trim() ? raw.id : `${fallback.id}-${index}`,
    type: safeType,
    title: raw.title && raw.title.trim() ? raw.title : fallback.title,
    x: Number.isFinite(x) ? clamp(x, 0, 100) : fallback.x,
    y: Number.isFinite(y) ? clamp(y, 0, 100) : fallback.y,
    w: Number.isFinite(w) ? clamp(w, 8, 100) : fallback.w,
    h: Number.isFinite(h) ? clamp(h, 6, 100) : fallback.h,
    z: Number.isFinite(z) ? z : fallback.z,
    visible: typeof raw.visible === 'boolean' ? raw.visible : true,
    config: sanitizeConfig(safeType, raw.config)
  }
}

export const normalizeStageLayout = (raw: unknown): StageLayout => {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_STAGE_LAYOUT
  }

  const maybeLayout = raw as Partial<StageLayout>
  const maybeItems = Array.isArray(maybeLayout.items) ? maybeLayout.items : []

  if (maybeItems.length === 0) {
    return DEFAULT_STAGE_LAYOUT
  }

  return {
    version: Number.isFinite(Number(maybeLayout.version)) ? Number(maybeLayout.version) : 1,
    items: maybeItems.map((item, index) =>
      sanitizeItem((item || {}) as Partial<StageLayoutItem>, index)
    )
  }
}

export const parseStageLayout = (raw: string | null | undefined): StageLayout => {
  if (!raw) return DEFAULT_STAGE_LAYOUT

  try {
    return normalizeStageLayout(JSON.parse(raw))
  } catch {
    return DEFAULT_STAGE_LAYOUT
  }
}

export const stageLayoutToJson = (layout: StageLayout): string => JSON.stringify(layout)
