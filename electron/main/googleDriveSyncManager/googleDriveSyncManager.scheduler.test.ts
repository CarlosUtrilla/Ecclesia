import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { paths, appMock, driveMock, OAuth2Mock } = vi.hoisted(() => {
  const localPaths = {
    userData: ''
  }

  const localAppMock = {
    getPath: vi.fn((name: string) => (name === 'userData' ? localPaths.userData : '')),
    on: vi.fn()
  }

  const localDriveMock = {
    files: {
      list: vi.fn(async () => ({ data: { files: [] } })),
      create: vi.fn(async () => ({
        data: { id: 'remote-file', modifiedTime: '2026-03-09T18:02:00.000Z' }
      })),
      update: vi.fn(async () => ({
        data: { id: 'remote-file', modifiedTime: '2026-03-09T18:02:00.000Z' }
      })),
      get: vi.fn()
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

  return {
    paths: localPaths,
    appMock: localAppMock,
    driveMock: localDriveMock,
    OAuth2Mock: LocalOAuth2Mock
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
      findMany: vi.fn(async () => [])
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

async function readStateSafe() {
  try {
    return await fs.readJSON(getSyncFilePath('google-drive-state.json'))
  } catch {
    return null
  }
}

describe('googleDriveSyncManager scheduler recovery', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-09T18:00:00.000Z'))

    paths.userData = await fs.mkdtemp(path.join(os.tmpdir(), 'ecclesia-sync-test-'))
    await fs.ensureDir(path.join(paths.userData, 'sync'))

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

    await fs.writeJSON(getSyncFilePath('google-drive-state.json'), {})
  })

  afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()

    if (paths.userData) {
      await fs.remove(paths.userData)
    }

    delete process.env.GOOGLE_DRIVE_CLIENT_ID
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET
  })

  it('registra backoff tras error y se recupera en el ciclo de retry', async () => {
    await expect(executeSyncCycle('interval')).rejects.toThrow(
      'No hay configuración o sesión activa de Google Drive'
    )

    const failedState = await fs.readJSON(getSyncFilePath('google-drive-state.json'))
    expect(failedState.lastRunStatus).toBe('error')
    expect(failedState.retryCount).toBe(1)
    expect(failedState.nextRetryAt).toBe('2026-03-09T18:00:30.000Z')

    await fs.writeJSON(getSyncFilePath('google-drive-token.json'), {
      access_token: 'recovered-token'
    })

    await expect(executeSyncCycle('retry')).resolves.toMatchObject({ synced: true })

    const recoveredState = await fs.readJSON(getSyncFilePath('google-drive-state.json'))
    expect(recoveredState.lastRunStatus).toBe('ok')
    expect(recoveredState.lastRunReason).toBe('retry')
    expect(recoveredState.retryCount).toBe(0)
    expect(recoveredState.nextRetryAt).toBe('')
  })

  it('ejecuta retry automatico por timer y limpia el backoff al recuperarse', async () => {
    await expect(executeSyncCycle('interval')).rejects.toThrow(
      'No hay configuración o sesión activa de Google Drive'
    )

    await fs.writeJSON(getSyncFilePath('google-drive-token.json'), {
      access_token: 'recovered-token'
    })

    await vi.advanceTimersByTimeAsync(30_000)

    let recoveredState = await readStateSafe()
    for (let attempts = 0; attempts < 30 && recoveredState?.lastRunStatus !== 'ok'; attempts += 1) {
      await vi.advanceTimersByTimeAsync(50)
      recoveredState = await readStateSafe()
    }

    expect(recoveredState?.lastRunStatus).toBe('ok')
    expect(recoveredState?.lastRunReason).toBe('retry')
    expect(recoveredState?.retryCount).toBe(0)
    expect(recoveredState?.nextRetryAt).toBe('')
  })
})
