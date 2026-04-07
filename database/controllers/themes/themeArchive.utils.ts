const IMPORT_SUFFIX = ' (importado)'
const FONT_VARIANT_SUFFIX_REGEX =
  /[-_\s]?(thin|extralight|ultralight|light|regular|book|roman|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|condensed|narrow)+$/i

export function ensureZipExtension(filePath: string) {
  return filePath.toLowerCase().endsWith('.zip') ? filePath : `${filePath}.zip`
}

export function sanitizeThemeArchiveBaseName(name: string) {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()

  return normalized.length > 0 ? normalized : 'tema'
}

export function buildUniqueThemeName(baseName: string, existingNames: string[]) {
  const normalizedBase = baseName.trim() || 'Tema importado'
  const usedNames = new Set(existingNames.map((name) => name.toLowerCase()))

  if (!usedNames.has(normalizedBase.toLowerCase())) {
    return normalizedBase
  }

  const importedName = `${normalizedBase}${IMPORT_SUFFIX}`
  if (!usedNames.has(importedName.toLowerCase())) {
    return importedName
  }

  let counter = 2
  while (usedNames.has(`${importedName} ${counter}`.toLowerCase())) {
    counter += 1
  }

  return `${importedName} ${counter}`
}

export function normalizeImportedMediaRelativePath(rawPath: string) {
  const normalized = rawPath.replace(/\\/g, '/').trim().replace(/^\/+/, '')
  if (normalized.length === 0) {
    return null
  }

  const segments = normalized.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null
  }

  return segments.join('/')
}

export function buildMediaRelativePathFromArchive(
  rawPath: string,
  fallbackBaseName: string,
  fallbackExtension: string
) {
  const normalized = normalizeImportedMediaRelativePath(rawPath)
  const safeExtension = fallbackExtension.startsWith('.') ? fallbackExtension : `.${fallbackExtension}`
  const safeBaseName = sanitizeThemeArchiveBaseName(fallbackBaseName) || 'tema-importado'

  if (!normalized) {
    return `files/themes-imports/${safeBaseName}${safeExtension}`
  }

  if (normalized.startsWith('files/')) {
    return normalized
  }

  return `files/themes-imports/${safeBaseName}${safeExtension}`
}

export function getMediaFolderFromRelativePath(relativePath: string) {
  const normalized = normalizeImportedMediaRelativePath(relativePath)
  if (!normalized || !normalized.startsWith('files/')) {
    return undefined
  }

  const segments = normalized.split('/').slice(1, -1)
  return segments.length > 0 ? segments.join('/') : undefined
}

export function extractPrimaryFontFamily(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const firstFamily = value.split(',')[0]?.trim().replace(/^['"]+|['"]+$/g, '')
  return firstFamily && firstFamily.length > 0 ? firstFamily : null
}

export function normalizeFontMatchValue(value: string) {
  return value.trim().replace(/^['"]+|['"]+$/g, '').toLowerCase()
}

export function getCustomFontFamilyFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '').trim()
  if (!withoutExtension) {
    return ''
  }

  const withoutVariant = withoutExtension.replace(FONT_VARIANT_SUFFIX_REGEX, '').trim()
  return withoutVariant || withoutExtension
}
