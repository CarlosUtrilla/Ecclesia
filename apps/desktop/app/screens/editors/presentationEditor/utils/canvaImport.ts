export type CanvaImportSourceSplit = {
  mp4Paths: string[]
  zipPaths: string[]
  rejectedPaths: string[]
}

export type CanvaResolvedAsset = {
  filePath: string
  folder?: string
  sourceKey: string
  slideNumber: number | null
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function getCanvaZipFolderBaseName(zipPath: string): string {
  const segments = zipPath.split(/[\\/]/)
  const rawName = segments[segments.length - 1] || ''
  const noExtension = rawName.replace(/\.zip$/i, '')
  const cleaned = normalizeWhitespace(noExtension)

  if (cleaned.length > 0) {
    return cleaned
  }

  return 'Canva Import'
}

export function getCanvaSourceKeyFromZipPath(zipPath: string): string {
  return getCanvaZipFolderBaseName(zipPath).toLowerCase()
}

export function getCanvaSourceKeyFromMp4Path(mp4Path: string): string {
  const segments = mp4Path.split(/[\\/]/)
  const rawName = segments[segments.length - 1] || ''
  const noExtension = rawName.replace(/\.mp4$/i, '')
  const cleaned = normalizeWhitespace(noExtension).toLowerCase()

  return cleaned.length > 0 ? `mp4:${cleaned}` : 'mp4:import'
}

export function extractCanvaSlideNumber(filePath: string): number | null {
  const segments = filePath.split(/[\\/]/)
  const rawName = segments[segments.length - 1] || ''
  const noExtension = rawName.replace(/\.[^/.]+$/, '')
  const normalizedName = normalizeWhitespace(noExtension)

  const exactNumeric = normalizedName.match(/^\d+$/)
  if (exactNumeric) {
    const parsed = Number(exactNumeric[0])
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }

  const firstNumericGroup = normalizedName.match(/(\d+)/)
  if (!firstNumericGroup) return null

  const parsed = Number(firstNumericGroup[1])
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function sortCanvaResolvedAssets(assets: CanvaResolvedAsset[]): CanvaResolvedAsset[] {
  return [...assets].sort((a, b) => {
    const aNumber = a.slideNumber
    const bNumber = b.slideNumber

    if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
      return aNumber - bNumber
    }

    if (aNumber !== null && bNumber === null) return -1
    if (aNumber === null && bNumber !== null) return 1

    return a.filePath.localeCompare(b.filePath, undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  })
}

export function getNextAvailableFolderName(baseName: string, occupiedNames: Set<string>): string {
  const normalizedBase = normalizeWhitespace(baseName) || 'Canva Import'

  if (!occupiedNames.has(normalizedBase)) {
    return normalizedBase
  }

  let index = 1
  while (occupiedNames.has(`${normalizedBase} (${index})`)) {
    index += 1
  }

  return `${normalizedBase} (${index})`
}

export function splitCanvaImportSourcePaths(filePaths: string[]): CanvaImportSourceSplit {
  const mp4Paths: string[] = []
  const zipPaths: string[] = []
  const rejectedPaths: string[] = []

  for (const currentPath of filePaths) {
    const lowerPath = currentPath.toLowerCase()

    if (lowerPath.endsWith('.mp4')) {
      mp4Paths.push(currentPath)
      continue
    }

    if (lowerPath.endsWith('.zip')) {
      zipPaths.push(currentPath)
      continue
    }

    rejectedPaths.push(currentPath)
  }

  return {
    mp4Paths,
    zipPaths,
    rejectedPaths
  }
}
