import { beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'path'
import os from 'os'
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

  it('should return false and remove stale manifest entries when local blob file is missing', async () => {
    const result = await (service as any).blobExistsLocally('sha256-abc', {
      entries: [{ checksum: 'sha256-abc', path: 'thumbnails/abc.jpg', size: 123, mtime: 1 }],
    })

    expect(result).toBe(false)
    expect(await fs.pathExists(path.join(mediaRoot, 'thumbnails/abc.jpg'))).toBe(false)
    const savedManifest = await fs.readJson(manifestPath)
    expect(savedManifest).toEqual({ entries: [] })
  })
})
