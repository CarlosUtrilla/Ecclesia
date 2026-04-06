import ffmpeg from '@ffmpeg-installer/ffmpeg'
import { spawn } from 'child_process'
import path from 'path'

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
  return ffmpeg.path.replace('app.asar', 'app.asar.unpacked')
}

function resolveSharp(): SharpFn | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require('sharp') as { default?: SharpFn } | SharpFn
    return (loaded as { default?: SharpFn }).default ?? (loaded as SharpFn)
  } catch {
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
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    proc.on('error', reject)
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
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    proc.on('error', reject)
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
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    proc.on('error', reject)
  })
}

export function buildThumbnailFileName(baseName: string, hash: string): string {
  return `thumb-${baseName.replaceAll(' ', '_')}-${hash}.jpg`
}

export function buildFallbackFileName(baseName: string, hash: string): string {
  return `fallback-${baseName.replaceAll(' ', '_')}-${hash}.jpg`
}

export function getThumbnailsPath(userDataPath: string): string {
  return path.join(userDataPath, 'media', 'thumbnails')
}
