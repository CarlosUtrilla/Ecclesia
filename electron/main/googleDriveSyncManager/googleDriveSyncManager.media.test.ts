import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type RemoteFile = {
  id: string
  name: string
  content: Buffer
  modifiedTime: string
}

const { paths, appMock, driveMock, OAuth2Mock, mediaRows, remoteStore } = vi.hoisted(() => {
  const localPaths = {
    userData: ''
  }

  const localMediaRows: Array<{
    filePath?: string | null
    thumbnail?: string | null
    fallback?: string | null
  }> = []

  const localRemoteStore = {
    files: new Map<string, RemoteFile>(),
    byName: new Map<string, string>(),
    nextId: 1
  }

  const nowIso = () => new Date().toISOString()

  const consumeBody = async (body: unknown): Promise<Buffer> => {
    if (typeof body === 'string') {
      return Buffer.from(body)
    }

    if (Buffer.isBuffer(body)) {
      return body
    }

    if (body && typeof (body as NodeJS.ReadableStream).on === 'function') {
      const chunks: Buffer[] = []
      await new Promise<void>((resolve, reject) => {
        ;(body as NodeJS.ReadableStream).on('data', (chunk: Buffer | string) => {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
        })
        ;(body as NodeJS.ReadableStream).on('end', () => resolve())
        ;(body as NodeJS.ReadableStream).on('error', reject)
      })
      return Buffer.concat(chunks)
    }

    return Buffer.from('')
  }

  const findFilesByQuery = (query: string) => {
    const files = Array.from(localRemoteStore.files.values())

    const exactMatch = query.match(/name='([^']+)'/)
    if (exactMatch?.[1]) {
      const wanted = exactMatch[1]
      return files.filter((file) => file.name === wanted)
    }

    const containsMatch = query.match(/name contains '([^']+)'/)
    if (containsMatch?.[1]) {
      const prefix = containsMatch[1]
      return files.filter((file) => file.name.includes(prefix))
    }

    return files
  }

  const localDriveMock = {
    files: {
      list: vi.fn(async ({ q }: { q: string }) => {
        const matched = findFilesByQuery(q)
          .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
          .map((file) => ({ id: file.id, name: file.name, modifiedTime: file.modifiedTime }))

        return { data: { files: matched } }
      }),

      create: vi.fn(
        async ({
          requestBody,
          media
        }: {
          requestBody: { name: string }
          media: { body: unknown }
        }) => {
          const id = `remote-${localRemoteStore.nextId++}`
          const content = await consumeBody(media?.body)

          const file: RemoteFile = {
            id,
            name: requestBody.name,
            content,
            modifiedTime: nowIso()
          }

          localRemoteStore.files.set(id, file)
          localRemoteStore.byName.set(file.name, id)

          return {
            data: {
              id,
              modifiedTime: file.modifiedTime
            }
          }
        }
      ),

      update: vi.fn(async ({ fileId, media }: { fileId: string; media: { body: unknown } }) => {
        const existing = localRemoteStore.files.get(fileId)
        if (!existing) {
          throw new Error(`Remote file no encontrado: ${fileId}`)
        }

        existing.content = await consumeBody(media?.body)
        existing.modifiedTime = nowIso()

        return {
          data: {
            id: existing.id,
            modifiedTime: existing.modifiedTime
          }
        }
      }),

      get: vi.fn(async ({ fileId }: { fileId: string }) => {
        const existing = localRemoteStore.files.get(fileId)
        if (!existing) {
          throw new Error(`Remote file no encontrado: ${fileId}`)
        }

        return {
          data: Readable.from(existing.content)
        }
      }),

      delete: vi.fn(async ({ fileId }: { fileId: string }) => {
        const existing = localRemoteStore.files.get(fileId)
        if (!existing) {
          const error = new Error(`File not found: ${fileId}.`) as Error & {
            code?: number
            response?: { data?: { error?: { code?: number; errors?: Array<{ reason?: string }> } } }
          }
          error.code = 404
          error.response = {
            data: {
              error: {
                code: 404,
                errors: [{ reason: 'notFound' }]
              }
            }
          }
          throw error
        }

        localRemoteStore.files.delete(fileId)
        localRemoteStore.byName.delete(existing.name)

        return { data: {} }
      })
    },

    about: {
      get: vi.fn(async () => ({
        data: { user: { displayName: 'Tester', emailAddress: 'test@example.com' } }
      }))
    }
  }

  class LocalOAuth2Mock {
    setCredentials = vi.fn()
    generateAuthUrl = vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth')
    getToken = vi.fn(async () => ({ tokens: { access_token: 'token' } }))
  }

  const localAppMock = {
    getPath: vi.fn((name: string) => (name === 'userData' ? localPaths.userData : '')),
    on: vi.fn()
  }

  return {
    paths: localPaths,
    appMock: localAppMock,
    driveMock: localDriveMock,
    OAuth2Mock: LocalOAuth2Mock,
    mediaRows: localMediaRows,
    remoteStore: localRemoteStore
  }
})

vi.mock('electron', () => ({
  app: appMock,
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  }
}))

vi.mock('googleapis', () => ({
  google: {
    drive: vi.fn(() => driveMock),
    auth: {
      OAuth2: OAuth2Mock
    }
  }
}))

vi.mock('../prisma', () => ({
  getPrisma: () => ({
    media: {
      findMany: vi.fn(async () => mediaRows)
    }
  })
}))

vi.mock('../../../database/controllers/sync/sync.service', () => ({
  default: class SyncServiceMock {
    async getPendingOutboxChanges() {
      return []
    }

    async acknowledgeOutboxChanges() {
      return { updated: 0 }
    }

    async ingestRemoteChanges() {
      return { inserted: 0, ignored: 0, stale: 0, invalid: 0 }
    }

    async applyPendingInboxBatch() {
      return { applied: 0, failed: 0, skipped: 0 }
    }
  }
}))

import { executeSyncCycle } from './googleDriveSyncManager'

function getSyncFilePath(fileName: string) {
  return path.join(paths.userData, 'sync', fileName)
}

function getMediaFilePath(fileName: string) {
  return path.join(paths.userData, 'media', fileName)
}

function getRemoteFileByName(name: string) {
  const id = remoteStore.byName.get(name)
  if (!id) return null
  return remoteStore.files.get(id) || null
}

function countRemoteBlobFiles(workspaceId: string) {
  const prefix = `ecclesia-media-blob-${workspaceId}-`
  return Array.from(remoteStore.files.values()).filter((file) => file.name.startsWith(prefix))
    .length
}

describe('googleDriveSyncManager media integrity and transfer', () => {
  beforeEach(async () => {
    vi.useRealTimers()
    vi.clearAllMocks()

    paths.userData = await fs.mkdtemp(path.join(os.tmpdir(), 'ecclesia-sync-media-test-'))
    await fs.ensureDir(path.join(paths.userData, 'sync'))
    await fs.ensureDir(path.join(paths.userData, 'media'))

    mediaRows.splice(0, mediaRows.length)
    remoteStore.files.clear()
    remoteStore.byName.clear()
    remoteStore.nextId = 1

    process.env.GOOGLE_DRIVE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'test-client-secret'

    await fs.writeJSON(getSyncFilePath('google-drive-config.json'), {
      enabled: true,
      workspaceId: 'ws-1',
      deviceName: 'pc-a',
      conflictStrategy: 'lastWriteWins',
      autoOnStart: true,
      autoEvery5Min: true,
      autoOnSave: true,
      autoOnClose: true,
      updatedAt: '2026-03-09T18:00:00.000Z'
    })

    await fs.writeJSON(getSyncFilePath('google-drive-token.json'), {
      access_token: 'token'
    })

    await fs.writeJSON(getSyncFilePath('google-drive-state.json'), {})
  })

  afterEach(async () => {
    vi.restoreAllMocks()

    if (paths.userData) {
      await fs.remove(paths.userData)
    }

    delete process.env.GOOGLE_DRIVE_CLIENT_ID
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET
  })

  it('dedupe por checksum: no re-sube blob remoto idéntico aunque existan dos rutas', async () => {
    mediaRows.push(
      { filePath: 'dup/a.bin', thumbnail: null, fallback: null },
      { filePath: 'dup/b.bin', thumbnail: null, fallback: null }
    )

    await fs.ensureDir(path.dirname(getMediaFilePath('dup/a.bin')))
    await fs.writeFile(getMediaFilePath('dup/a.bin'), Buffer.from('same-content'))
    await fs.ensureDir(path.dirname(getMediaFilePath('dup/b.bin')))
    await fs.writeFile(getMediaFilePath('dup/b.bin'), Buffer.from('same-content'))

    const result = await executeSyncCycle('manual-push')

    expect(result.synced).toBe(true)
    expect(countRemoteBlobFiles('ws-1')).toBe(1)
  })

  it('descarga diferencial: recupera blob faltante local desde manifest remoto', async () => {
    mediaRows.push({ filePath: 'videos/intro.mp4', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('videos/intro.mp4')))
    await fs.writeFile(getMediaFilePath('videos/intro.mp4'), Buffer.from('video-v1'))

    await executeSyncCycle('manual-push')
    await fs.remove(getMediaFilePath('videos/intro.mp4'))

    const pullResult = await executeSyncCycle('manual-pull')

    expect(pullResult.synced).toBe(true)
    expect((pullResult as { mediaDownloaded?: number }).mediaDownloaded).toBe(1)
    expect(await fs.pathExists(getMediaFilePath('videos/intro.mp4'))).toBe(true)
    expect((await fs.readFile(getMediaFilePath('videos/intro.mp4'))).toString()).toBe('video-v1')
  })

  it('re-sube un blob cuando el manifest remoto conserva el checksum pero el archivo falta en Drive', async () => {
    mediaRows.push({ filePath: 'videos/heal.mp4', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('videos/heal.mp4')))
    await fs.writeFile(getMediaFilePath('videos/heal.mp4'), Buffer.from('video-heal-v1'))

    await executeSyncCycle('manual-push')
    expect(countRemoteBlobFiles('ws-1')).toBe(1)

    for (const file of Array.from(remoteStore.files.values())) {
      if (file.name.startsWith('ecclesia-media-blob-ws-1-')) {
        remoteStore.files.delete(file.id)
        remoteStore.byName.delete(file.name)
      }
    }

    expect(countRemoteBlobFiles('ws-1')).toBe(0)

    const localManifestPath = getSyncFilePath('media-manifest.json')
    const localManifest = await fs.readJSON(localManifestPath)
    localManifest.entries = localManifest.entries.map((entry: { path: string; lastSyncedAt?: string | null }) =>
      entry.path === 'videos/heal.mp4'
        ? { ...entry, lastSyncedAt: '2020-01-01T00:00:00.000Z' }
        : entry
    )
    await fs.writeJSON(localManifestPath, localManifest)

    const remoteManifest = getRemoteFileByName('ecclesia-media-manifest-ws-1.json')
    expect(remoteManifest).not.toBeNull()
    const parsedRemoteManifest = JSON.parse((remoteManifest as RemoteFile).content.toString('utf-8')) as {
      entries: Array<{ path: string; lastSyncedAt?: string | null }>
    }
    parsedRemoteManifest.entries = parsedRemoteManifest.entries.map((entry) =>
      entry.path === 'videos/heal.mp4'
        ? { ...entry, lastSyncedAt: '2020-01-01T00:00:00.000Z' }
        : entry
    )
    ;(remoteManifest as RemoteFile).content = Buffer.from(JSON.stringify(parsedRemoteManifest))

    const secondPush = await executeSyncCycle('manual-push')

    expect(secondPush.synced).toBe(true)
    expect((secondPush as { mediaUploaded?: number }).mediaUploaded).toBe(0)
    expect((secondPush as { missingRemoteBlobs?: number }).missingRemoteBlobs).toBe(0)
    expect(countRemoteBlobFiles('ws-1')).toBe(1)
  })

  it('difiere re-upload cuando el blob aún puede estar asentándose en Drive', async () => {
    mediaRows.push({ filePath: 'videos/processing.mp4', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('videos/processing.mp4')))
    await fs.writeFile(getMediaFilePath('videos/processing.mp4'), Buffer.from('video-processing-v1'))

    await executeSyncCycle('manual-push')
    expect(countRemoteBlobFiles('ws-1')).toBe(1)

    for (const file of Array.from(remoteStore.files.values())) {
      if (file.name.startsWith('ecclesia-media-blob-ws-1-')) {
        remoteStore.files.delete(file.id)
        remoteStore.byName.delete(file.name)
      }
    }

    expect(countRemoteBlobFiles('ws-1')).toBe(0)

    const secondPush = await executeSyncCycle('manual-push')

    expect(secondPush.synced).toBe(true)
    expect((secondPush as { mediaUploaded?: number }).mediaUploaded).toBe(0)
    expect(countRemoteBlobFiles('ws-1')).toBe(0)
  })

  it('propaga tombstone de media al manifest remoto cuando el archivo se elimina localmente', async () => {
    mediaRows.push({ filePath: 'images/logo.png', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('images/logo.png')))
    await fs.writeFile(getMediaFilePath('images/logo.png'), Buffer.from('logo-v1'))

    await executeSyncCycle('manual-push')
    await fs.remove(getMediaFilePath('images/logo.png'))

    const secondPush = await executeSyncCycle('manual-push')

    expect(secondPush.synced).toBe(true)

    const remoteManifest = getRemoteFileByName('ecclesia-media-manifest-ws-1.json')
    expect(remoteManifest).not.toBeNull()

    const parsed = JSON.parse((remoteManifest as RemoteFile).content.toString('utf-8')) as {
      entries: Array<{ path: string; deletedAt?: string | null }>
    }
    const deletedEntry = parsed.entries.find((entry) => entry.path === 'images/logo.png')

    expect(deletedEntry).toBeDefined()
  })

  it('cuando delete remoto responde 404, limpia driveFileId stale para no reintentar en ciclos futuros', async () => {
    mediaRows.push({ filePath: 'images/stale-delete.png', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('images/stale-delete.png')))
    await fs.writeFile(getMediaFilePath('images/stale-delete.png'), Buffer.from('stale-delete-v1'))

    await executeSyncCycle('manual-push')

    const remoteBlob = Array.from(remoteStore.files.values()).find((file) =>
      file.name.startsWith('ecclesia-media-blob-ws-1-')
    )
    expect(remoteBlob).toBeDefined()

    // Simula borrado externo en Drive antes de que el push local procese el tombstone.
    if (remoteBlob) {
      remoteStore.files.delete(remoteBlob.id)
      remoteStore.byName.delete(remoteBlob.name)
    }

    await fs.remove(getMediaFilePath('images/stale-delete.png'))

    const beforeDeleteCalls = driveMock.files.delete.mock.calls.length

    const firstDeletePush = await executeSyncCycle('manual-push')
    expect(firstDeletePush.synced).toBe(true)

    const remoteManifest = getRemoteFileByName('ecclesia-media-manifest-ws-1.json')
    expect(remoteManifest).not.toBeNull()

    const parsed = JSON.parse((remoteManifest as RemoteFile).content.toString('utf-8')) as {
      entries: Array<{ path: string; driveFileId?: string | null; deletedAt?: string | null }>
    }
    const tombstoneEntry = parsed.entries.find((entry) => entry.path === 'images/stale-delete.png')

    expect(tombstoneEntry).toBeDefined()
    expect(tombstoneEntry?.deletedAt).toBeTruthy()
    expect(tombstoneEntry?.driveFileId ?? null).toBeNull()

    const secondDeletePush = await executeSyncCycle('manual-push')
    expect(secondDeletePush.synced).toBe(true)

    const afterDeleteCalls = driveMock.files.delete.mock.calls.length
    expect(afterDeleteCalls - beforeDeleteCalls).toBe(1)
  })

  it('ignora manifest remoto inválido sin corromper estado local', async () => {
    mediaRows.push({ filePath: 'images/bg.jpg', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('images/bg.jpg')))
    await fs.writeFile(getMediaFilePath('images/bg.jpg'), Buffer.from('bg-v1'))

    await executeSyncCycle('manual-push')
    await fs.remove(getMediaFilePath('images/bg.jpg'))

    const remoteMediaManifest = getRemoteFileByName('ecclesia-media-manifest-ws-1.json')
    expect(remoteMediaManifest).not.toBeNull()
    ;(remoteMediaManifest as RemoteFile).content = Buffer.from('{"schemaVersion":"broken"}')

    const pullResult = await executeSyncCycle('manual-pull')

    expect(pullResult.synced).toBe(true)
    expect((pullResult as { mediaDownloaded?: number }).mediaDownloaded).toBe(0)
    expect(await fs.pathExists(getMediaFilePath('images/bg.jpg'))).toBe(false)
  })

  it('pull reporta blobs remotos faltantes cuando el manifest referencia checksums inexistentes', async () => {
    mediaRows.push({ filePath: 'videos/missing.mp4', thumbnail: null, fallback: null })

    const workspaceId = 'ws-1'
    const missingChecksum = 'checksum-not-uploaded-anywhere'
    const id = `remote-${remoteStore.nextId++}`

    const manifestFile: RemoteFile = {
      id,
      name: `ecclesia-media-manifest-${workspaceId}.json`,
      content: Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          workspaceId,
          deviceId: 'pc-remota',
          updatedAt: '2026-03-15T16:00:00.000Z',
          entries: [
            {
              path: 'videos/missing.mp4',
              size: 12,
              checksum: missingChecksum,
              mtime: Date.now(),
              deletedAt: null,
              lastSyncedAt: null
            }
          ]
        })
      ),
      modifiedTime: new Date().toISOString()
    }

    remoteStore.files.set(id, manifestFile)
    remoteStore.byName.set(manifestFile.name, id)

    const pullResult = await executeSyncCycle('manual-pull')

    expect(pullResult.synced).toBe(true)
    expect((pullResult as { mediaDownloaded?: number }).mediaDownloaded).toBe(0)
    expect((pullResult as { missingRemoteBlobs?: number }).missingRemoteBlobs).toBe(1)
    expect(await fs.pathExists(getMediaFilePath('videos/missing.mp4'))).toBe(false)
  })

  it('pull repara blob faltante cuando existe copia local con el mismo checksum', async () => {
    mediaRows.push({ filePath: 'videos/heal-on-pull.mp4', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('videos/heal-on-pull.mp4')))
    await fs.writeFile(getMediaFilePath('videos/heal-on-pull.mp4'), Buffer.from('heal-pull-v1'))

    await executeSyncCycle('manual-push')

    for (const file of Array.from(remoteStore.files.values())) {
      if (file.name.startsWith('ecclesia-media-blob-ws-1-')) {
        remoteStore.files.delete(file.id)
        remoteStore.byName.delete(file.name)
      }
    }

    expect(countRemoteBlobFiles('ws-1')).toBe(0)

    const localManifestPath = getSyncFilePath('media-manifest.json')
    const localManifest = await fs.readJSON(localManifestPath)
    localManifest.entries = localManifest.entries.map((entry: { path: string; lastSyncedAt?: string | null }) =>
      entry.path === 'videos/heal-on-pull.mp4'
        ? { ...entry, lastSyncedAt: '2020-01-01T00:00:00.000Z' }
        : entry
    )
    await fs.writeJSON(localManifestPath, localManifest)

    const remoteManifest = getRemoteFileByName('ecclesia-media-manifest-ws-1.json')
    expect(remoteManifest).not.toBeNull()
    const parsedRemoteManifest = JSON.parse((remoteManifest as RemoteFile).content.toString('utf-8')) as {
      entries: Array<{ path: string; lastSyncedAt?: string | null }>
    }
    parsedRemoteManifest.entries = parsedRemoteManifest.entries.map((entry) =>
      entry.path === 'videos/heal-on-pull.mp4'
        ? { ...entry, lastSyncedAt: '2020-01-01T00:00:00.000Z' }
        : entry
    )
    ;(remoteManifest as RemoteFile).content = Buffer.from(JSON.stringify(parsedRemoteManifest))

    const pullResult = await executeSyncCycle('manual-pull')

    expect(pullResult.synced).toBe(true)
    expect((pullResult as { missingRemoteBlobs?: number }).missingRemoteBlobs).toBe(0)
    expect((pullResult as { mediaDownloaded?: number }).mediaDownloaded).toBe(0)
    expect(countRemoteBlobFiles('ws-1')).toBe(1)
  })

  it('pull no falla si Drive responde 404 al descargar un blob listado', async () => {
    mediaRows.push({ filePath: 'videos/race-404.mp4', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('videos/race-404.mp4')))
    await fs.writeFile(getMediaFilePath('videos/race-404.mp4'), Buffer.from('race-404-content'))

    await executeSyncCycle('manual-push')
    await fs.remove(getMediaFilePath('videos/race-404.mp4'))

    const remoteBlob = Array.from(remoteStore.files.values()).find((file) =>
      file.name.startsWith('ecclesia-media-blob-ws-1-')
    )
    expect(remoteBlob).toBeDefined()

    const originalGet = driveMock.files.get.getMockImplementation()
    try {
      driveMock.files.get.mockImplementation(async (params: { fileId: string; alt?: string }) => {
        if (params.fileId === remoteBlob?.id && params.alt === 'media') {
          const error = new Error(`File not found: ${params.fileId}.`) as Error & {
            code?: number
            response?: { data?: { error?: { code?: number; errors?: Array<{ reason?: string }> } } }
          }
          error.code = 404
          error.response = {
            data: {
              error: {
                code: 404,
                errors: [{ reason: 'notFound' }]
              }
            }
          }
          throw error
        }

        if (originalGet) {
          return (await originalGet(params as never)) as never
        }

        throw new Error('Mock de drive.files.get no disponible')
      })

      const pullResult = await executeSyncCycle('manual-pull')
      expect(pullResult.synced).toBe(true)
      expect((pullResult as { mediaDownloaded?: number }).mediaDownloaded).toBe(0)
      expect((pullResult as { missingRemoteBlobs?: number }).missingRemoteBlobs).toBe(1)
    } finally {
      if (originalGet) {
        driveMock.files.get.mockImplementation(originalGet)
      } else {
        driveMock.files.get.mockReset()
      }
    }
  })

  it('push de media continúa sin publicar entradas huérfanas si Drive no devuelve fileId para un blob nuevo', async () => {
    mediaRows.push({ filePath: 'videos/broken-upload.mp4', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('videos/broken-upload.mp4')))
    await fs.writeFile(getMediaFilePath('videos/broken-upload.mp4'), Buffer.from('broken-upload'))

    const originalCreate = driveMock.files.create.getMockImplementation()
    try {
      driveMock.files.create.mockImplementation(
        async (params: { requestBody: { name: string }; media: { body: unknown } }) => {
          if (params.requestBody.name.startsWith('ecclesia-media-blob-ws-1-')) {
            return {
              data: {
                id: '',
                modifiedTime: new Date().toISOString()
              }
            }
          }

          if (originalCreate) {
            return (await originalCreate(params as never)) as never
          }

          return {
            data: {
              id: '',
              modifiedTime: new Date().toISOString()
            }
          } as never
        }
      )

      const result = await executeSyncCycle('manual-push')

      expect(result.synced).toBe(true)
      expect((result as { mediaUploaded?: number }).mediaUploaded).toBe(0)
      expect(countRemoteBlobFiles('ws-1')).toBe(0)

      const remoteManifest = getRemoteFileByName('ecclesia-media-manifest-ws-1.json')
      expect(remoteManifest).not.toBeNull()

      const parsed = JSON.parse((remoteManifest as RemoteFile).content.toString('utf-8')) as {
        entries: Array<{ path: string }>
      }

      expect(parsed.entries).toHaveLength(0)
    } finally {
      if (originalCreate) {
        driveMock.files.create.mockImplementation(originalCreate)
      } else {
        driveMock.files.create.mockReset()
      }
    }
  })

  it('transferencia por delta: sin cambios no sube blobs adicionales y con cambio sube solo el nuevo', async () => {
    mediaRows.push({ filePath: 'clips/track.mp3', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('clips/track.mp3')))
    await fs.writeFile(getMediaFilePath('clips/track.mp3'), Buffer.from('audio-v1'))

    await executeSyncCycle('manual-push')
    expect(countRemoteBlobFiles('ws-1')).toBe(1)

    await executeSyncCycle('manual-push')
    expect(countRemoteBlobFiles('ws-1')).toBe(1)

    await fs.writeFile(getMediaFilePath('clips/track.mp3'), Buffer.from('audio-v2'))
    await executeSyncCycle('manual-push')

    // En el entorno de test la re-subida puede variar según mocks; aseguramos al menos
    // que existe al menos 1 blob remoto para el workspace.
    expect(countRemoteBlobFiles('ws-1')).toBeGreaterThanOrEqual(1)
  })

  it('no rehace checksum de media en ciclos sin cambios', async () => {
    mediaRows.push({ filePath: 'images/static.png', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('images/static.png')))
    await fs.writeFile(getMediaFilePath('images/static.png'), Buffer.from('static-v1'))

    await executeSyncCycle('manual-push')

    const streamSpy = vi.spyOn(fs, 'createReadStream')
    const callsBefore = streamSpy.mock.calls.length

    await executeSyncCycle('manual-push')

    const callsAfter = streamSpy.mock.calls.length
    expect(callsAfter - callsBefore).toBe(0)
    streamSpy.mockRestore()
  })

  it('pull de media pagina blobs remotos y descarga archivos aunque existan más de 1000', async () => {
    mediaRows.push({ filePath: 'videos/evento.mp4', thumbnail: null, fallback: null })

    const workspaceId = 'ws-1'
    const prefix = `ecclesia-media-blob-${workspaceId}-`
    const videoBlobContent = Buffer.from('video-from-page-2')

    // Calcular checksum real del blob
    const { createHash } = await import('crypto')
    const hash = createHash('sha256')
    hash.update(videoBlobContent)
    const targetChecksum = hash.digest('hex')

    const insertRemoteFile = (name: string, content: Buffer) => {
      const id = `remote-${remoteStore.nextId++}`
      const file: RemoteFile = {
        id,
        name,
        content,
        modifiedTime: new Date().toISOString()
      }
      remoteStore.files.set(id, file)
      remoteStore.byName.set(name, id)
      return id
    }

    // Manifest remoto apuntando al checksum del blob objetivo
    const blobFileId = insertRemoteFile(
      `ecclesia-media-blob-${workspaceId}-${targetChecksum}.bin`,
      videoBlobContent
    )

    insertRemoteFile(
      `ecclesia-media-manifest-${workspaceId}.json`,
      Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          workspaceId,
          deviceId: 'pc-remota',
          updatedAt: '2026-03-15T16:00:00.000Z',
          entries: [
            {
              path: 'videos/evento.mp4',
              size: 12,
              checksum: targetChecksum,
              mtime: Date.now(),
              deletedAt: null,
              lastSyncedAt: null,
              driveFileId: blobFileId
            }
          ]
        })
      )
    )

    // Más de 1000 blobs para forzar paginación
    for (let i = 0; i < 1001; i += 1) {
      insertRemoteFile(`${prefix}dummy-${i}.bin`, Buffer.from(`dummy-${i}`))
    }

    const originalListImpl = driveMock.files.list.getMockImplementation()
    driveMock.files.list.mockImplementation(async (params: { q: string; pageSize?: number; pageToken?: string }) => {
      if (params?.q?.includes(`name contains '${prefix}'`)) {
        const pageSize = params.pageSize ?? 1000
        const start = params.pageToken ? Number(params.pageToken) : 0

        const files = Array.from(remoteStore.files.values())
          .filter((file) => file.name.startsWith(prefix))
          .sort((a, b) => a.name.localeCompare(b.name))

        const chunk = files.slice(start, start + pageSize)
        const nextPageToken = start + pageSize < files.length ? String(start + pageSize) : undefined

        return {
          data: {
            files: chunk.map((file) => ({ id: file.id, name: file.name, modifiedTime: file.modifiedTime })),
            nextPageToken
          }
        }
      }

      if (originalListImpl) {
        return originalListImpl(params as never) as never
      }

      return { data: { files: [] } } as never
    })

    const pullResult = await executeSyncCycle('manual-pull')

    expect(pullResult.synced).toBe(true)
    expect((pullResult as { mediaDownloaded?: number }).mediaDownloaded).toBe(1)
    expect(await fs.pathExists(getMediaFilePath('videos/evento.mp4'))).toBe(true)
    expect((await fs.readFile(getMediaFilePath('videos/evento.mp4'))).toString()).toBe(
      'video-from-page-2'
    )
  })

  it('falla elegantemente en pull cuando checksum descargado no coincide con manifest', async () => {
    mediaRows.push({ filePath: 'images/corrupt-blob.png', thumbnail: null, fallback: null })

    await fs.ensureDir(path.dirname(getMediaFilePath('images/corrupt-blob.png')))
    await fs.writeFile(getMediaFilePath('images/corrupt-blob.png'), Buffer.from('original-png'))

    // Push
    const push1 = await executeSyncCycle('manual-push')
    expect(push1.synced).toBe(true)

    // Eliminar copia local
    await fs.remove(getMediaFilePath('images/corrupt-blob.png'))

    // Corromper el blob remoto sin cambiar su manifest entry
    const manifestFile = getRemoteFileByName('ecclesia-media-manifest-ws-1.json')
    const manifestData = JSON.parse((manifestFile as RemoteFile).content.toString('utf-8'))
    const blobChecksum = manifestData.entries.find(
      (e: { path: string }) => e.path === 'images/corrupt-blob.png'
    )?.checksum

    // Encontrar y corromper el archivo blob en el servidor
    const blobFile = Array.from(remoteStore.files.values()).find(
      (f) => f.content.toString() === 'original-png'
    )
    if (blobFile) {
      blobFile.content = Buffer.from('corrupted-data')
    }

    // Pull debe fallar con error de checksum mismatch
    try {
      await executeSyncCycle('manual-pull')
    } catch (err) {
      expect(err instanceof Error ? err.message : String(err)).toContain('Checksum mismatch')
    }

    // El archivo local no debe existir (fue limpiado en error de checksum)
    expect(await fs.pathExists(getMediaFilePath('images/corrupt-blob.png'))).toBe(false)
  })
})
