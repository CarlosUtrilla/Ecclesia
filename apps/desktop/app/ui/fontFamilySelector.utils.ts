export type CustomFontLike = {
  name: string
  fileName: string
  id: number
}

export type GroupedCustomFontOption = {
  label: string
  value: string
  variantCount: number
  fontIds: number[]
  fileNames: string[]
}

import { getCustomFontFamily } from '@/lib/customFontUtils'

export function buildGroupedCustomFontOptions(fonts: CustomFontLike[]): GroupedCustomFontOption[] {
  const byFamily = new Map<string, CustomFontLike[]>()

  for (const font of fonts) {
    const family = getCustomFontFamily(font.name)
    if (!family) continue

    if (!byFamily.has(family)) {
      byFamily.set(family, [])
    }
    byFamily.get(family)!.push(font)
  }

  return Array.from(byFamily.entries())
    .map(([family, familyFonts]) => {
      return {
        label: family,
        value: family,
        variantCount: familyFonts.length,
        fontIds: familyFonts.map((f) => f.id),
        fileNames: familyFonts.map((f) => f.fileName)
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function resolveSelectedCustomFontValue(
  currentValue: string,
  groupedOptions: GroupedCustomFontOption[]
): string {
  if (!currentValue) return currentValue

  const direct = groupedOptions.find((option) => option.value === currentValue)
  if (direct) return direct.value

  const fromGroup = groupedOptions.find(
    (option) => option.label === getCustomFontFamily(currentValue)
  )
  if (fromGroup) return fromGroup.value

  return currentValue
}
