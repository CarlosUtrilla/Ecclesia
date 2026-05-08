export type ParsedCustomFontVariant = {
  family: string
  weight: number
  style: 'normal' | 'italic' | 'oblique'
}

const FONT_VARIANT_SUFFIX_REGEX =
  /[-_\s]?(thin|extralight|ultralight|light|regular|book|roman|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|condensed|narrow)+$/i

const WEIGHT_TOKENS: Array<{ token: RegExp; weight: number }> = [
  { token: /thin/i, weight: 100 },
  { token: /extralight|ultralight/i, weight: 200 },
  { token: /light/i, weight: 300 },
  { token: /regular|book|roman/i, weight: 400 },
  { token: /medium/i, weight: 500 },
  { token: /semibold|demibold/i, weight: 600 },
  { token: /bold/i, weight: 700 },
  { token: /extrabold|ultrabold/i, weight: 800 },
  { token: /black|heavy/i, weight: 900 }
]

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '')
}

export function normalizeCustomFontName(name: string): string {
  return stripExtension(name).replace(/['"]/g, '').trim()
}

export function getCustomFontFamily(name: string): string {
  const cleaned = normalizeCustomFontName(name)
  if (!cleaned) return ''

  const withoutSuffix = cleaned.replace(FONT_VARIANT_SUFFIX_REGEX, '').trim()
  return withoutSuffix || cleaned
}

export function parseCustomFontVariant(nameOrFileName: string): ParsedCustomFontVariant {
  const normalized = normalizeCustomFontName(nameOrFileName)
  const lower = normalized.toLowerCase()

  const family = getCustomFontFamily(normalized)

  let weight = 400
  for (const entry of WEIGHT_TOKENS) {
    if (entry.token.test(lower)) {
      weight = entry.weight
      break
    }
  }

  const style: ParsedCustomFontVariant['style'] = /oblique/i.test(lower)
    ? 'oblique'
    : /italic/i.test(lower)
      ? 'italic'
      : 'normal'

  return {
    family,
    weight,
    style
  }
}
