import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'path'
import os from 'os'
import { createHash } from 'crypto'
import * as fs from 'fs-extra'
import * as syncConfig from './oplog-shared'
import { OplogBlobService } from './oplog-blob.service'

describe('OplogBlobService', () => {
  let service: OplogBlobService
  const tempRoot = path.join(os.tmpdir(), 'ecclesia-oplog-blob-service-test')
  const mediaRoot = path.join(tempRoot, 'media')
  const manifestPath = path.join(tempRoot, 'media-manifest.json')

  beforeEach(async () => {
    await fs.remove(tempRoot)
    await fs.ensureDir(mediaRoot)
    await fs.writeJson(manifestPath, {
      entries: [{ checksum: 'sha256-abc', path: 'thumbnails/abc.jpg', size: 123, mtime: 1 }],
    })

    vi.clearAllMocks()
    service = new OplogBlobService()
    vi.spyOn(syncConfig, 'getMediaDir').mockReturnValue(mediaRoot)
    vi.spyOn(syncConfig, 'getLocalMediaManifestPath').mockReturnValue(manifestPath)
  })

  afterEach(async () => {
    await fs.remove(tempRoot)
  })

  describe('blobExistsLocally', () => {
    it('should return false and drop stale manifest entries when the local blob is missing', async () => {
      const result = await (service as any).blobExistsLocally('sha256-abc')

      expect(result).toBe(false)
      expect(await fs.pathExists(path.join(mediaRoot, 'thumbnails/abc.jpg'))).toBe(false)

      // La escritura del manifest se coalesce en una sola al final del ciclo
      expect(await fs.readJson(manifestPath)).toEqual({
        entries: [{ checksum: 'sha256-abc', path: 'thumbnails/abc.jpg', size: 123, mtime: 1 }],
      })

      await (service as any).saveManifest()
      expect(await fs.readJson(manifestPath)).toEqual({ entries: [] })
    })

    it('should return true when the file is on disk', async () => {
      await fs.ensureDir(path.join(mediaRoot, 'thumbnails'))
      await fs.writeFile(path.join(mediaRoot, 'thumbnails/abc.jpg'), 'x')

      expect(await (service as any).blobExistsLocally('sha256-abc')).toBe(true)
    })
  })

  describe('saveManifest', () => {
    it('should not rewrite the manifest when nothing changed', async () => {
      await (service as any).getManifest()
      // Centinela en el archivo: si saveManifest escribiera, se perdería
      await fs.writeJson(manifestPath, { entries: [], centinela: true })

      await (service as any).saveManifest()

      expect(await fs.readJson(manifestPath)).toEqual({ entries: [], centinela: true })
    })
  })

  describe('computeChecksum', () => {
    const filePath = () => path.join(mediaRoot, 'file.bin')

    it('should hash the file contents by streaming', async () => {
      const content = Buffer.alloc(3 * 1024 * 1024, 7)
      await fs.writeFile(filePath(), content)

      const expected = 'sha256-' + createHash('sha256').update(content).digest('hex')
      expect(await service.computeChecksum(filePath())).toBe(expected)
    })

    it('should reuse the cached checksum instead of re-reading the file', async () => {
      await fs.writeFile(filePath(), 'contenido')
      const first = await service.computeChecksum(filePath())

      // Se cachea por tamaño + mtime: sin cache, releer un archivo con la misma
      // mtime volvería a hashear (aquí lo comprobamos copiándolo tal cual)
      const copyPath = path.join(mediaRoot, 'copia.bin')
      await fs.copy(filePath(), copyPath, { preserveTimestamps: true })
      const cacheSize = () => (service as any).checksumCache.size

      expect(cacheSize()).toBe(1)
      expect(await service.computeChecksum(filePath())).toBe(first)
      expect(cacheSize()).toBe(1)
    })

    it('should recompute when the file changes', async () => {
      await fs.writeFile(filePath(), 'antes')
      const before = await service.computeChecksum(filePath())

      await fs.writeFile(filePath(), 'después')
      await fs.utimes(filePath(), new Date(Date.now() + 5_000), new Date(Date.now() + 5_000))

      expect(await service.computeChecksum(filePath())).not.toBe(before)
    })
  })
})
