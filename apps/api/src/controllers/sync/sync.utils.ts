import fs from 'fs-extra'
import { createHash } from 'crypto'
import path from 'path'

export async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    if (!(await fs.pathExists(filePath))) return null
    return (await fs.readJSON(filePath)) as T
  } catch {
    return null
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeJSON(filePath, value, { spaces: 2 })
}

export async function ensureDir(filePath: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath))
}

export async function streamToString(readable: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    readable.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    })
    readable.on('end', () => resolve())
    readable.on('error', reject)
  })
  return Buffer.concat(chunks).toString('utf-8')
}

export async function computeFileChecksum(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk: Buffer | string) => hash.update(chunk))
    stream.on('end', () => resolve())
    stream.on('error', reject)
  })
  return hash.digest('hex')
}
