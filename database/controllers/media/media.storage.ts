import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import os from 'os'
import AdmZip from 'adm-zip'
import { MediaType } from '@prisma/client'
import {
  buildFallbackFileName,
  buildThumbnailFileName,
  generateImageThumbnail,
  generateVideoFallback,
  generateVideoThumbnail,
  getThumbnailsPath
} from '../../../electron/main/mediaManager/mediaThumbnails'

export const SUPPORTED_IMAGE_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
export const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.webm', '.mov', '.avi']

export function normalizeMediaPath(mediaPath: string): string {
  return mediaPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

export function resolveMediaRoot(): string {
  return path.join(app.getPath('userData'), 'media')
}

export function resolveFilesRoot(): string {
  return path.join(resolveMediaRoot(), 'files')
}

export function resolveThumbnailsRoot(): string {
  return getThumbnailsPath(app.getPath('userData'))
}

export function resolveNormalizedPath(base: string, relativePath: string): string {
  const normalized = normalizeMediaPath(relativePath)
  return path.join(base, ...normalized.split('/'))
}

function ensureDir(directory: string) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
}

function copyFolderRecursive(source: string, target: string) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true })
  }

  const files = fs.readdirSync(source)

  for (const file of files) {
    const sourcePath = path.join(source, file)
    const targetPath = path.join(target, file)

    if (fs.statSync(sourcePath).isDirectory()) {
      copyFolderRecursive(sourcePath, targetPath)
    } else {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

export async function importMediaFromSourcePath(
  sourcePath: string,
  folder?: string
): Promise<{
  name: string
  type: MediaType
  format: string
  filePath: string
  fileSize: number
  thumbnail: string
  fallback?: string
  folder?: string
}> {
  const mediaRoot = resolveMediaRoot()
  const filesRoot = resolveFilesRoot()
  const thumbnailsRoot = resolveThumbnailsRoot()

  ensureDir(mediaRoot)
  ensureDir(filesRoot)
  ensureDir(thumbnailsRoot)

  const folderNormalized = folder ? normalizeMediaPath(folder) : ''
  const targetFolderPath = folderNormalized
    ? path.join(filesRoot, ...folderNormalized.split('/'))
    : filesRoot
  ensureDir(targetFolderPath)

  const ext = path.extname(sourcePath).toLowerCase()
  const stats = fs.statSync(sourcePath)
  const originalName = path.basename(sourcePath, ext)
  const hash = crypto.randomBytes(8).toString('hex')

  let type: MediaType
  if (SUPPORTED_IMAGE_FORMATS.includes(ext)) {
    type = MediaType.IMAGE
  } else if (SUPPORTED_VIDEO_FORMATS.includes(ext)) {
    type = MediaType.VIDEO
  } else {
    throw new Error(`Formato no soportado: ${ext}`)
  }

  const newFileName = `${originalName}-${hash}${ext}`
  const destPath = path.join(targetFolderPath, newFileName)
  fs.copyFileSync(sourcePath, destPath)

  if (process.platform === 'win32') {
    try {
      fs.chmodSync(destPath, 0o644)
    } catch {
      // No blocking if chmod falla
    }
  }

  const thumbnailFileName = buildThumbnailFileName(originalName, hash)
  const thumbnailPath = path.join(thumbnailsRoot, thumbnailFileName)
  let fallbackFileName: string | undefined

  if (type === MediaType.IMAGE) {
    await generateImageThumbnail(sourcePath, thumbnailPath)
  } else {
    await generateVideoThumbnail(destPath, thumbnailPath)
    fallbackFileName = buildFallbackFileName(originalName, hash)
    const fallbackPath = path.join(thumbnailsRoot, fallbackFileName)
    await generateVideoFallback(destPath, fallbackPath)
  }

  const filePath = folderNormalized
    ? `files/${folderNormalized}/${newFileName}`
    : `files/${newFileName}`

  return {
    name: originalName,
    type,
    format: ext.slice(1),
    filePath,
    fileSize: stats.size,
    thumbnail: `thumbnails/${thumbnailFileName}`,
    fallback: fallbackFileName ? `thumbnails/${fallbackFileName}` : undefined,
    folder: folderNormalized || undefined
  }
}

export async function importClipboardImage(
  bytes: number[],
  mimeType: string,
  folder?: string
): Promise<{
  name: string
  type: MediaType
  format: string
  filePath: string
  fileSize: number
  thumbnail: string
  fallback?: string
  folder?: string
}> {
  if (!Array.isArray(bytes) || bytes.length === 0) {
    throw new Error('La imagen del portapapeles está vacía')
  }

  if (!mimeType.startsWith('image/')) {
    throw new Error('El contenido del portapapeles no es una imagen válida')
  }

  const extension = getImageExtensionFromMimeType(mimeType)
  const tempRoot = path.join(os.tmpdir(), 'ecclesia-clipboard-imports')
  ensureDir(tempRoot)

  const tempFilePath = path.join(
    tempRoot,
    `clipboard-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`
  )

  fs.writeFileSync(tempFilePath, Buffer.from(bytes))

  try {
    return await importMediaFromSourcePath(tempFilePath, folder)
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath)
    }
  }
}

export function deleteFile(filePath: string, thumbnail?: string | null): boolean {
  const mediaRoot = resolveMediaRoot()
  const fileFullPath = resolveNormalizedPath(mediaRoot, normalizeMediaPath(filePath))

  if (fs.existsSync(fileFullPath)) {
    fs.unlinkSync(fileFullPath)
  }

  if (thumbnail) {
    const thumbnailFullPath = resolveNormalizedPath(mediaRoot, normalizeMediaPath(thumbnail))
    if (fs.existsSync(thumbnailFullPath)) {
      fs.unlinkSync(thumbnailFullPath)
    }
  }

  return true
}

export function createMediaFolder(folderPath: string): { success: boolean; path: string } {
  const filesRoot = resolveFilesRoot()
  const normalizedFolder = normalizeMediaPath(folderPath)
  const fullPath = resolveNormalizedPath(filesRoot, normalizedFolder)
  ensureDir(fullPath)
  return { success: true, path: normalizedFolder }
}

export function deleteMediaFolder(folderPath: string): { success: boolean } {
  const filesRoot = resolveFilesRoot()
  const normalizedFolder = normalizeMediaPath(folderPath)
  const fullPath = resolveNormalizedPath(filesRoot, normalizedFolder)

  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true })
  }

  return { success: true }
}

export function renameMediaPath(
  oldPath: string,
  newName: string
): { success: boolean; newPath: string } {
  const filesRoot = resolveFilesRoot()
  const normalizedOldPath = normalizeMediaPath(oldPath)
  const oldFullPath = resolveNormalizedPath(filesRoot, normalizedOldPath)
  const directory = path.posix.dirname(normalizedOldPath)
  const oldExt = path.posix.extname(normalizedOldPath)
  const newExt = path.posix.extname(newName)
  const finalNewName = newExt ? newName : `${newName}${oldExt}`
  const newPath = directory === '.' ? finalNewName : `${directory}/${finalNewName}`
  const newFullPath = resolveNormalizedPath(filesRoot, newPath)

  if (!fs.existsSync(oldFullPath)) {
    throw new Error(`El archivo "${oldPath}" no existe en la ubicación esperada: ${oldFullPath}`)
  }

  if (fs.existsSync(newFullPath)) {
    throw new Error('Ya existe un archivo o carpeta con ese nombre')
  }

  fs.renameSync(oldFullPath, newFullPath)
  return { success: true, newPath }
}

export function listMediaFolders(parentFolder?: string): string[] {
  const filesRoot = resolveFilesRoot()
  const targetPath = parentFolder
    ? resolveNormalizedPath(filesRoot, normalizeMediaPath(parentFolder))
    : filesRoot

  if (!fs.existsSync(targetPath)) {
    return []
  }

  const items = fs.readdirSync(targetPath, { withFileTypes: true })
  return items.filter((item) => item.isDirectory()).map((item) => item.name)
}

export function moveMediaPath(
  sourcePath: string,
  targetFolder: string | null
): { success: boolean; newPath: string } {
  const filesRoot = resolveFilesRoot()
  const normalizedSource = normalizeMediaPath(sourcePath)
  const sourceFullPath = resolveNormalizedPath(filesRoot, normalizedSource)
  const fileName = path.posix.basename(normalizedSource)
  const targetNormalized = targetFolder ? normalizeMediaPath(targetFolder) : ''
  const destinationRelativePath = targetNormalized ? `${targetNormalized}/${fileName}` : fileName
  const targetFullPath = resolveNormalizedPath(filesRoot, destinationRelativePath)

  if (!fs.existsSync(sourceFullPath)) {
    throw new Error(
      `El archivo "${sourcePath}" no existe en la ubicación esperada: ${sourceFullPath}`
    )
  }

  if (fs.existsSync(targetFullPath)) {
    throw new Error('Ya existe un archivo o carpeta con ese nombre en el destino')
  }

  ensureDir(path.dirname(targetFullPath))
  fs.renameSync(sourceFullPath, targetFullPath)

  return { success: true, newPath: destinationRelativePath }
}

export function copyMediaSource(
  sourcePath: string,
  targetFolder: string | null,
  isFolder: boolean
): { success: boolean; newPath: string; newFileName: string; newThumbnail?: string } {
  const filesRoot = resolveFilesRoot()
  const normalizedSource = normalizeMediaPath(sourcePath)
  const sourceFullPath = resolveNormalizedPath(filesRoot, normalizedSource)
  const fileName = path.posix.basename(normalizedSource)
  const ext = path.posix.extname(fileName)
  const baseName = path.posix.basename(fileName, ext)
  const hash = crypto.randomBytes(4).toString('hex')
  const targetNormalized = targetFolder ? normalizeMediaPath(targetFolder) : ''
  const newFileName = ext ? `${baseName}-copia-${hash}${ext}` : `${baseName}-copia-${hash}`
  const targetRelativePath = targetNormalized ? `${targetNormalized}/${newFileName}` : newFileName
  const targetFullPath = resolveNormalizedPath(filesRoot, targetRelativePath)
  ensureDir(path.dirname(targetFullPath))

  if (!fs.existsSync(sourceFullPath)) {
    throw new Error(`El archivo o carpeta "${sourcePath}" no existe`)
  }

  if (isFolder) {
    copyFolderRecursive(sourceFullPath, targetFullPath)
    return { success: true, newPath: targetRelativePath, newFileName }
  }

  fs.copyFileSync(sourceFullPath, targetFullPath)

  let newThumbnailPath: string | undefined
  const thumbnailsRoot = resolveThumbnailsRoot()

  if (fs.existsSync(thumbnailsRoot)) {
    const thumbnailFiles = fs.readdirSync(thumbnailsRoot)
    const sourceBaseName = path.posix.basename(normalizedSource, ext)

    for (const thumbFile of thumbnailFiles) {
      if (thumbFile.includes(sourceBaseName)) {
        const sourceThumbPath = path.join(thumbnailsRoot, thumbFile)
        const newThumbName = `thumb-${sourceBaseName.replace(/\s+/g, '_')}-copia-${hash}.jpg`
        const targetThumbPath = path.join(thumbnailsRoot, newThumbName)
        fs.copyFileSync(sourceThumbPath, targetThumbPath)
        newThumbnailPath = `thumbnails/${newThumbName}`
        break
      }
    }
  }

  return { success: true, newPath: targetRelativePath, newFileName, newThumbnail: newThumbnailPath }
}

export function extractZipMp4(zipPath: string): { tempDir: string; mp4Paths: string[] } {
  if (!fs.existsSync(zipPath)) {
    throw new Error('El archivo ZIP no existe')
  }

  if (!zipPath.toLowerCase().endsWith('.zip')) {
    throw new Error('El archivo seleccionado no es ZIP')
  }

  const tempRoot = path.join(os.tmpdir(), 'ecclesia-canva-imports')
  ensureDir(tempRoot)

  const tempDir = path.join(tempRoot, `zip-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`)
  ensureDir(tempDir)

  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  const mp4Paths: string[] = []

  for (const entry of entries) {
    if (entry.isDirectory) continue

    const entryName = entry.entryName || ''
    if (!entryName.toLowerCase().endsWith('.mp4')) continue

    const safeName = path.basename(entryName)
    if (!safeName) continue

    const outputName = `${mp4Paths.length + 1}-${safeName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const outputPath = path.join(tempDir, outputName)
    fs.writeFileSync(outputPath, entry.getData())
    mp4Paths.push(outputPath)
  }

  return { tempDir, mp4Paths }
}

export function cleanupTempPath(targetPath: string): { success: boolean } {
  const tempRoot = path.join(os.tmpdir(), 'ecclesia-canva-imports')
  const normalizedRoot = path.resolve(tempRoot)
  const normalizedTarget = path.resolve(targetPath)

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error('Ruta temporal inválida para limpieza')
  }

  if (fs.existsSync(normalizedTarget)) {
    fs.rmSync(normalizedTarget, { recursive: true, force: true })
  }

  return { success: true }
}

function getImageExtensionFromMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  return '.png'
}
