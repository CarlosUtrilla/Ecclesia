import { Prisma, SyncOperation } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPrismaMock = vi.fn()
const runWithoutSyncOutboxTrackingMock = vi.fn(async (fn: () => Promise<unknown>) => await fn())

vi.mock('../../../electron/main/prisma', () => ({
  getPrisma: () => getPrismaMock(),
  runWithoutSyncOutboxTracking: (fn: () => Promise<unknown>) => runWithoutSyncOutboxTrackingMock(fn)
}))

import SyncService from './sync.service'

type SyncStateRow = {
  id: number
  workspaceId: string
  deviceId: string
  lastPulledAt: Date | null
  lastPushedAt: Date | null
  lastAckedChangeId: number | null
  createdAt: Date
  updatedAt: Date
}

type SyncOutboxRow = {
  id: number
  workspaceId: string
  deviceId: string
  tableName: string
  recordId: string
  operation: SyncOperation
  payload: string
  entityUpdatedAt: Date | null
  deletedAt: Date | null
  ackedAt: Date | null
  createdAt: Date
}

type SyncInboxRow = {
  id: number
  workspaceId: string
  sourceDeviceId: string
  remoteChangeId: string
  tableName: string
  recordId: string
  operation: SyncOperation
  payload: string
  entityUpdatedAt: Date | null
  deletedAt: Date | null
  appliedAt: Date | null
  createdAt: Date
}

type SongRow = {
  id: number
  title: string
  author: string | null
  copyright: string | null
  createdAt: Date
  updatedAt: Date
  fullText: string | null
}

type ThemeRow = {
  id: number
  name: string
  background: string | null
  backgroundMediaId: number | null
  textStyle: string | null
  animationSettings: string | null
  transitionSettings: string | null
  previewImage: string | null
  createdAt: Date
  updatedAt: Date
  biblePresentationSettingsId: number | null
  useDefaultBibleSettings: boolean
}

function createInMemoryPrisma() {
  const state = {
    syncState: [] as SyncStateRow[],
    syncOutboxChange: [] as SyncOutboxRow[],
    syncInboxChange: [] as SyncInboxRow[],
    song: [] as SongRow[],
    themes: [] as ThemeRow[]
  }

  const now = () => new Date()
  let stateId = 1
  let outboxId = 1
  let inboxId = 1

  const prismaLike: Record<string, any> = {
    syncState: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.workspaceId_deviceId
        return (
          state.syncState.find(
            (row) => row.workspaceId === key.workspaceId && row.deviceId === key.deviceId
          ) ?? null
        )
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = where.workspaceId_deviceId
        const existing = state.syncState.find(
          (row) => row.workspaceId === key.workspaceId && row.deviceId === key.deviceId
        )

        if (existing) {
          Object.assign(existing, update, { updatedAt: now() })
          return existing
        }

        const created: SyncStateRow = {
          id: stateId++,
          workspaceId: create.workspaceId,
          deviceId: create.deviceId,
          lastPulledAt: create.lastPulledAt ?? null,
          lastPushedAt: create.lastPushedAt ?? null,
          lastAckedChangeId: create.lastAckedChangeId ?? null,
          createdAt: now(),
          updatedAt: now()
        }
        state.syncState.push(created)
        return created
      })
    },

    syncOutboxChange: {
      create: vi.fn(async ({ data }: any) => {
        const row: SyncOutboxRow = {
          id: outboxId++,
          workspaceId: data.workspaceId,
          deviceId: data.deviceId,
          tableName: data.tableName,
          recordId: data.recordId,
          operation: data.operation,
          payload: data.payload,
          entityUpdatedAt: data.entityUpdatedAt ?? null,
          deletedAt: data.deletedAt ?? null,
          ackedAt: null,
          createdAt: now()
        }
        state.syncOutboxChange.push(row)
        return row
      }),

      findMany: vi.fn(async ({ where, orderBy, take }: any) => {
        let rows = state.syncOutboxChange.filter(
          (row) =>
            row.workspaceId === where.workspaceId &&
            row.deviceId === where.deviceId &&
            row.ackedAt === where.ackedAt
        )

        if (where.id?.gt !== undefined) {
          rows = rows.filter((row) => row.id > where.id.gt)
        }

        if (orderBy?.id === 'asc') {
          rows = rows.slice().sort((a, b) => a.id - b.id)
        }

        return rows.slice(0, take)
      }),

      updateMany: vi.fn(async ({ where, data }: any) => {
        let rows = state.syncOutboxChange.filter(
          (row) =>
            row.workspaceId === where.workspaceId &&
            row.deviceId === where.deviceId &&
            row.ackedAt === where.ackedAt
        )

        if (where.id?.in) {
          const inSet = new Set<number>(where.id.in)
          rows = rows.filter((row) => inSet.has(row.id))
        }
        if (where.id?.lte !== undefined) {
          rows = rows.filter((row) => row.id <= where.id.lte)
        }

        for (const row of rows) {
          row.ackedAt = data.ackedAt
        }

        return { count: rows.length }
      }),

      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        let rows = state.syncOutboxChange.filter(
          (row) =>
            row.workspaceId === where.workspaceId &&
            row.tableName === where.tableName &&
            row.recordId === where.recordId
        )

        if (where.entityUpdatedAt?.not === null) {
          rows = rows.filter((row) => row.entityUpdatedAt !== null)
        }

        if (where.ackedAt === null) {
          rows = rows.filter((row) => row.ackedAt === null)
        }

        if (orderBy) {
          rows = rows.slice().sort((a, b) => {
            const aTs = a.entityUpdatedAt?.getTime() ?? 0
            const bTs = b.entityUpdatedAt?.getTime() ?? 0
            if (aTs !== bTs) return bTs - aTs
            return b.id - a.id
          })
        }

        return rows[0] ?? null
      })
    },

    syncInboxChange: {
      create: vi.fn(async ({ data }: any) => {
        const duplicated = state.syncInboxChange.find(
          (row) =>
            row.workspaceId === data.workspaceId &&
            row.sourceDeviceId === data.sourceDeviceId &&
            row.remoteChangeId === data.remoteChangeId
        )

        if (duplicated) {
          throw new Prisma.PrismaClientKnownRequestError('Unique violation', {
            code: 'P2002',
            clientVersion: 'test'
          })
        }

        const row: SyncInboxRow = {
          id: inboxId++,
          workspaceId: data.workspaceId,
          sourceDeviceId: data.sourceDeviceId,
          remoteChangeId: data.remoteChangeId,
          tableName: data.tableName,
          recordId: data.recordId,
          operation: data.operation,
          payload: data.payload,
          entityUpdatedAt: data.entityUpdatedAt ?? null,
          deletedAt: data.deletedAt ?? null,
          appliedAt: null,
          createdAt: now()
        }

        state.syncInboxChange.push(row)
        return row
      }),

      findMany: vi.fn(async ({ where, orderBy, take }: any) => {
        let rows = state.syncInboxChange.filter(
          (row) => row.workspaceId === where.workspaceId && row.appliedAt === where.appliedAt
        )

        if (where.sourceDeviceId) {
          rows = rows.filter((row) => row.sourceDeviceId === where.sourceDeviceId)
        }

        if (where.afterId || where.id?.gt !== undefined) {
          const gt = where.id?.gt ?? where.afterId
          rows = rows.filter((row) => row.id > gt)
        }

        if (orderBy?.id === 'asc') {
          rows = rows.slice().sort((a, b) => a.id - b.id)
        }

        return rows.slice(0, take)
      }),

      updateMany: vi.fn(async ({ where, data }: any) => {
        const ids = new Set<number>(where.id.in)
        const rows = state.syncInboxChange.filter(
          (row) =>
            row.workspaceId === where.workspaceId && ids.has(row.id) && row.appliedAt === null
        )

        for (const row of rows) {
          row.appliedAt = data.appliedAt
        }

        return { count: rows.length }
      }),

      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        let rows = state.syncInboxChange.filter(
          (row) =>
            row.workspaceId === where.workspaceId &&
            row.tableName === where.tableName &&
            row.recordId === where.recordId
        )

        if (where.entityUpdatedAt?.not === null) {
          rows = rows.filter((row) => row.entityUpdatedAt !== null)
        }

        if (orderBy) {
          rows = rows.slice().sort((a, b) => {
            const aTs = a.entityUpdatedAt?.getTime() ?? 0
            const bTs = b.entityUpdatedAt?.getTime() ?? 0
            if (aTs !== bTs) return bTs - aTs
            return b.id - a.id
          })
        }

        return rows[0] ?? null
      })
    },

    song: {
      findUnique: vi.fn(async ({ where }: any) => {
        return state.song.find((row) => row.id === where.id) ?? null
      }),

      update: vi.fn(async ({ where, data }: any) => {
        const song = state.song.find((row) => row.id === where.id)
        if (!song) {
          throw new Error('Song no encontrado')
        }
        Object.assign(song, data, { updatedAt: now() })
        return song
      }),

      create: vi.fn(async ({ data }: any) => {
        const row: SongRow = {
          id: data.id,
          title: data.title ?? '',
          author: data.author ?? null,
          copyright: data.copyright ?? null,
          fullText: data.fullText ?? null,
          createdAt: data.createdAt ?? now(),
          updatedAt: now()
        }
        state.song.push(row)
        return row
      }),

      delete: vi.fn(async ({ where }: any) => {
        const idx = state.song.findIndex((row) => row.id === where.id)
        if (idx === -1) throw new Error('Song no encontrado')
        const [deleted] = state.song.splice(idx, 1)
        return deleted
      })
    },

    themes: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id !== undefined) {
          return state.themes.find((row) => row.id === where.id) ?? null
        }
        if (where.name !== undefined) {
          return state.themes.find((row) => row.name === where.name) ?? null
        }
        return null
      }),

      update: vi.fn(async ({ where, data }: any) => {
        const theme =
          where.id !== undefined
            ? state.themes.find((row) => row.id === where.id)
            : state.themes.find((row) => row.name === where.name)

        if (!theme) {
          throw new Error('Theme no encontrado')
        }

        Object.assign(theme, data, { updatedAt: now() })
        return theme
      }),

      create: vi.fn(async ({ data }: any) => {
        const row: ThemeRow = {
          id: data.id,
          name: data.name ?? '',
          background: data.background ?? null,
          backgroundMediaId: data.backgroundMediaId ?? null,
          textStyle: data.textStyle ?? null,
          animationSettings: data.animationSettings ?? null,
          transitionSettings: data.transitionSettings ?? null,
          previewImage: data.previewImage ?? null,
          createdAt: data.createdAt ?? now(),
          updatedAt: now(),
          biblePresentationSettingsId: data.biblePresentationSettingsId ?? null,
          useDefaultBibleSettings: data.useDefaultBibleSettings ?? false
        }

        state.themes.push(row)
        return row
      }),

      delete: vi.fn(async ({ where }: any) => {
        const idx =
          where.id !== undefined
            ? state.themes.findIndex((row) => row.id === where.id)
            : state.themes.findIndex((row) => row.name === where.name)

        if (idx === -1) throw new Error('Theme no encontrado')
        const [deleted] = state.themes.splice(idx, 1)
        return deleted
      })
    }
  }

  prismaLike.$transaction = vi.fn(async (handler: (tx: typeof prismaLike) => Promise<unknown>) => {
    return await handler(prismaLike)
  })

  return { prismaLike, state }
}

describe('SyncService integration-lite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('flujo remoto completo: ingest -> pending -> apply -> pending vacío', async () => {
    const { prismaLike, state } = createInMemoryPrisma()

    state.song.push({
      id: 1,
      title: 'Titulo local',
      author: null,
      copyright: null,
      fullText: null,
      createdAt: new Date('2026-03-09T08:00:00.000Z'),
      updatedAt: new Date('2026-03-09T09:00:00.000Z')
    })

    getPrismaMock.mockReturnValue(prismaLike)

    const service = new SyncService()

    const ingestResult = await service.ingestRemoteChanges({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b',
      changes: [
        {
          remoteChangeId: 'r-1',
          tableName: 'Song',
          recordId: '1',
          operation: SyncOperation.UPDATE,
          payload: JSON.stringify({ id: 1, title: 'Titulo remoto aplicado' }),
          entityUpdatedAt: '2026-03-09T10:00:00.000Z'
        }
      ]
    })

    expect(ingestResult.inserted).toBe(1)

    const pendingBeforeApply = await service.getPendingInboxChanges({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b'
    })
    expect(pendingBeforeApply).toHaveLength(1)

    const applyResult = await service.applyPendingInboxBatch({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b',
      limit: 20
    })

    expect(applyResult.applied).toBe(1)
    expect(state.song[0].title).toBe('Titulo remoto aplicado')

    const pendingAfterApply = await service.getPendingInboxChanges({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b'
    })

    expect(pendingAfterApply).toHaveLength(0)
    expect(runWithoutSyncOutboxTrackingMock).toHaveBeenCalledTimes(1)
  })

  it('flujo local completo: append outbox -> pending -> ack -> pending vacío', async () => {
    const { prismaLike } = createInMemoryPrisma()
    getPrismaMock.mockReturnValue(prismaLike)

    const service = new SyncService()

    await service.appendOutboxChange({
      workspaceId: 'ws-1',
      deviceId: 'pc-a',
      tableName: 'Song',
      recordId: '101',
      operation: SyncOperation.CREATE,
      payload: JSON.stringify({ id: 101, title: 'Cancion nueva' }),
      entityUpdatedAt: '2026-03-09T12:00:00.000Z'
    })

    await service.appendOutboxChange({
      workspaceId: 'ws-1',
      deviceId: 'pc-a',
      tableName: 'Song',
      recordId: '102',
      operation: SyncOperation.UPDATE,
      payload: JSON.stringify({ id: 102, title: 'Cancion editada' }),
      entityUpdatedAt: '2026-03-09T12:05:00.000Z'
    })

    const pendingBeforeAck = await service.getPendingOutboxChanges({
      workspaceId: 'ws-1',
      deviceId: 'pc-a'
    })

    expect(pendingBeforeAck).toHaveLength(2)

    const ackResult = await service.acknowledgeOutboxChanges({
      workspaceId: 'ws-1',
      deviceId: 'pc-a',
      upToId: pendingBeforeAck[1].id
    })

    expect(ackResult.updated).toBe(2)

    const pendingAfterAck = await service.getPendingOutboxChanges({
      workspaceId: 'ws-1',
      deviceId: 'pc-a'
    })

    expect(pendingAfterAck).toHaveLength(0)

    const syncState = await service.getSyncState({
      workspaceId: 'ws-1',
      deviceId: 'pc-a'
    })

    expect(syncState?.lastAckedChangeId).toBe(2)
    expect(syncState?.lastPushedAt).toBeInstanceOf(Date)
  })

  it('multi-PC: A crea canción y B crea tema sin pérdida de datos', async () => {
    const { prismaLike, state } = createInMemoryPrisma()
    getPrismaMock.mockReturnValue(prismaLike)

    const service = new SyncService()

    state.song.push({
      id: 300,
      title: 'Canción A',
      author: null,
      copyright: null,
      fullText: null,
      createdAt: new Date('2026-03-09T16:00:00.000Z'),
      updatedAt: new Date('2026-03-09T16:00:00.000Z')
    })

    await service.appendOutboxChange({
      workspaceId: 'ws-1',
      deviceId: 'pc-a',
      tableName: 'Song',
      recordId: '300',
      operation: SyncOperation.CREATE,
      payload: JSON.stringify({ id: 300, title: 'Canción A' }),
      entityUpdatedAt: '2026-03-09T16:00:00.000Z'
    })

    const ingestResult = await service.ingestRemoteChanges({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b',
      changes: [
        {
          remoteChangeId: 'remote-theme-1',
          tableName: 'Themes',
          recordId: '90',
          operation: SyncOperation.CREATE,
          payload: JSON.stringify({ id: 90, name: 'Tema B' }),
          entityUpdatedAt: '2026-03-09T16:01:00.000Z'
        }
      ]
    })

    expect(ingestResult.inserted).toBe(1)

    const applyResult = await service.applyPendingInboxBatch({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b'
    })

    expect(applyResult.applied).toBe(1)
    expect(state.song.some((song) => song.id === 300)).toBe(true)
    expect(state.themes.some((theme) => theme.id === 90 && theme.name === 'Tema B')).toBe(true)

    const pendingOutbox = await service.getPendingOutboxChanges({
      workspaceId: 'ws-1',
      deviceId: 'pc-a'
    })

    expect(pendingOutbox).toHaveLength(1)
  })

  it('multi-PC: A y B editan el mismo tema y el remoto queda diferido por conflicto', async () => {
    const { prismaLike, state } = createInMemoryPrisma()
    getPrismaMock.mockReturnValue(prismaLike)

    const service = new SyncService()

    state.themes.push({
      id: 55,
      name: 'Tema X',
      background: null,
      backgroundMediaId: null,
      textStyle: null,
      animationSettings: null,
      transitionSettings: null,
      previewImage: null,
      createdAt: new Date('2026-03-09T10:00:00.000Z'),
      updatedAt: new Date('2026-03-09T10:00:00.000Z'),
      biblePresentationSettingsId: null,
      useDefaultBibleSettings: false
    })

    await service.appendOutboxChange({
      workspaceId: 'ws-1',
      deviceId: 'pc-a',
      tableName: 'Themes',
      recordId: '55',
      operation: SyncOperation.UPDATE,
      payload: JSON.stringify({ id: 55, name: 'Tema X A' }),
      entityUpdatedAt: '2026-03-09T16:10:00.000Z'
    })

    await service.ingestRemoteChanges({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b',
      changes: [
        {
          remoteChangeId: 'remote-theme-55',
          tableName: 'Themes',
          recordId: '55',
          operation: SyncOperation.UPDATE,
          payload: JSON.stringify({ id: 55, name: 'Tema X B' }),
          entityUpdatedAt: '2026-03-09T16:11:00.000Z'
        }
      ]
    })

    const applyResult = await service.applyPendingInboxBatch({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b'
    })

    expect(applyResult.conflicts).toBe(1)
    expect(applyResult.applied).toBe(0)
    expect(state.themes.find((theme) => theme.id === 55)?.name).toBe('Tema X')

    const pendingInbox = await service.getPendingInboxChanges({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b'
    })

    expect(pendingInbox).toHaveLength(1)
  })

  it('eliminación cruzada: DELETE remoto es idempotente si el registro ya no existe localmente', async () => {
    const { prismaLike } = createInMemoryPrisma()
    getPrismaMock.mockReturnValue(prismaLike)

    const service = new SyncService()

    const ingestResult = await service.ingestRemoteChanges({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b',
      changes: [
        {
          remoteChangeId: 'remote-delete-song-777',
          tableName: 'Song',
          recordId: '777',
          operation: SyncOperation.DELETE,
          payload: JSON.stringify({ id: 777, deletedAt: '2026-03-09T16:20:00.000Z' }),
          entityUpdatedAt: '2026-03-09T16:20:00.000Z',
          deletedAt: '2026-03-09T16:20:00.000Z'
        }
      ]
    })

    expect(ingestResult.inserted).toBe(1)

    const applyResult = await service.applyPendingInboxBatch({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b'
    })

    expect(applyResult.applied).toBe(1)
    expect(applyResult.failed).toBe(0)

    const pendingInbox = await service.getPendingInboxChanges({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b'
    })

    expect(pendingInbox).toHaveLength(0)
  })
})
