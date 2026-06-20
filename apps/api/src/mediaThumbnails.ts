import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { log } from './utils/logger'

type SharpFn = (input: string) => {
  resize: (
    width: number,
    height: number,
    options: { fit: 'cover'; position: 'center' }
  ) => {
    jpeg: (options: { quality: number }) => {
      toFile: (destPath: string) => Promise<void>
    }
  }
}

function resolveFfmpegPath(): string {
  const subdir = `${process.platform}-${process.arch}`
  const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

  const checkPath = (p: string): string | null =>
    fs.existsSync(p) ? p : null

  // 1. Try parent package @ffmpeg-installer/ffmpeg (works on host platform, or production with asarUnpack)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpeg = require('@ffmpeg-installer/ffmpeg') as { path: string }
    if (typeof ffmpeg?.path === 'string') {
      const resolved = ffmpeg.path.replace('app.asar', 'app.asar.unpacked')
      const found = checkPath(resolved)
      if (found) return found
    }
  } catch {
    log.warn('[Thumbnail] @ffmpeg-installer/ffmpeg require failed')
  }

  // 2. Try resourcesPath (production, app.asar.unpacked)
  try {
    const resourcesPath = (process as any).resourcesPath as string | undefined
    if (resourcesPath) {
      const productionCandidates = [
        path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '@ffmpeg-installer', subdir, exeName),
        path.join(resourcesPath, 'app.asar', 'node_modules', '@ffmpeg-installer', subdir, exeName),
        path.join(resourcesPath, 'node_modules', '@ffmpeg-installer', subdir, exeName),
      ]
      for (const c of productionCandidates) {
        const found = checkPath(c)
        if (found) return found
      }
    }
  } catch {
    log.warn('[Thumbnail] resourcesPath resolution failed')
  }

  // 3. Search node_modules via require.resolve paths (dev mode fallback, cross-platform builds)
  try {
    const resolvePaths = require.resolve.paths('@ffmpeg-installer/ffmpeg') || []
    for (const base of resolvePaths) {
      const candidate = path.join(base, '@ffmpeg-installer', subdir, exeName)
      const found = checkPath(candidate)
      if (found) return found
    }
  } catch {
    // require.resolve.paths not available
  }

  log.warn('[Thumbnail] ffmpeg not found anywhere, returning "ffmpeg" as last resort')
  return 'ffmpeg'
}

function resolveSharp(): SharpFn | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require('sharp') as { default?: SharpFn } | SharpFn
    return (loaded as { default?: SharpFn }).default ?? (loaded as SharpFn)
  } catch (err) {
    log.error('[Thumbnail] sharp failed to load, falling back to ffmpeg:', err)
    return null
  }
}

export async function generateImageThumbnail(sourcePath: string, destPath: string): Promise<void> {
  const sharp = resolveSharp()

  if (sharp) {
    await sharp(sourcePath)
      .resize(400, 300, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 80 })
      .toFile(destPath)
    return
  }

  await new Promise<void>((resolve, reject) => {
    const ffmpegPath = resolveFfmpegPath()
    const args = [
      '-i',
      sourcePath,
      '-vframes',
      '1',
      '-vf',
      'scale=400:300:force_original_aspect_ratio=decrease',
      '-q:v',
      '2',
      destPath
    ]
    const proc = spawn(ffmpegPath, args)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else {
        log.error(`[Thumbnail] FFmpeg image thumbnail exited with code ${code} for:`, sourcePath)
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    proc.on('error', (err) => {
      log.error(`[Thumbnail] FFmpeg image thumbnail error for ${sourcePath}:`, err)
      reject(err)
    })
  })
}

export function generateVideoThumbnail(sourcePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = resolveFfmpegPath()
    const args = [
      '-i',
      sourcePath,
      '-ss',
      '00:00:01.5',
      '-vframes',
      '1',
      '-vf',
      'scale=400:300:force_original_aspect_ratio=decrease',
      '-q:v',
      '2',
      destPath
    ]
    const proc = spawn(ffmpegPath, args)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else {
        log.error(`[Thumbnail] FFmpeg video thumbnail exited with code ${code} for:`, sourcePath)
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    proc.on('error', (err) => {
      log.error(`[Thumbnail] FFmpeg video thumbnail error for ${sourcePath}:`, err)
      reject(err)
    })
  })
}

export function generateVideoFallback(sourcePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = resolveFfmpegPath()
    const args = [
      '-i',
      sourcePath,
      '-ss',
      '00:00:00.1',
      '-vframes',
      '1',
      '-vf',
      'scale=-1:1080:force_original_aspect_ratio=decrease',
      '-q:v',
      '2',
      destPath
    ]
    const proc = spawn(ffmpegPath, args)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else {
        log.error(`[Thumbnail] FFmpeg video fallback exited with code ${code} for:`, sourcePath)
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    proc.on('error', (err) => {
      log.error(`[Thumbnail] FFmpeg video fallback error for ${sourcePath}:`, err)
      reject(err)
    })
  })
}

export function buildThumbnailFileName(baseName: string, hash: string): string {
  return `thumb-${baseName.replaceAll(' ', '_')}-${hash}.jpg`
}

export function buildFallbackFileName(baseName: string, hash: string): string {
  return `fallback-${baseName.replaceAll(' ', '_')}-${hash}.jpg`
}
