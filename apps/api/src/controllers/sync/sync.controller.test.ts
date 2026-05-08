import { SyncOperation } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

const { serviceMethods, SyncServiceCtorMock } = vi.hoisted(() => {
  const methods = {
    getSyncState: vi.fn(),
    upsertSyncState: vi.fn(),
    appendOutboxChange: vi.fn(),
    getPendingOutboxChanges: vi.fn(),
    acknowledgeOutboxChanges: vi.fn(),
    ingestRemoteChanges: vi.fn(),
    getPendingInboxChanges: vi.fn(),
    markInboxChangesApplied: vi.fn(),
    applyPendingInboxBatch: vi.fn()
  }

  const SyncServiceMockClass = class {
    getSyncState = methods.getSyncState
    upsertSyncState = methods.upsertSyncState
    appendOutboxChange = methods.appendOutboxChange
    getPendingOutboxChanges = methods.getPendingOutboxChanges
    acknowledgeOutboxChanges = methods.acknowledgeOutboxChanges
    ingestRemoteChanges = methods.ingestRemoteChanges
    getPendingInboxChanges = methods.getPendingInboxChanges
    markInboxChangesApplied = methods.markInboxChangesApplied
    applyPendingInboxBatch = methods.applyPendingInboxBatch
  }

  return {
    serviceMethods: methods,
    SyncServiceCtorMock: vi.fn(SyncServiceMockClass)
  }
})

vi.mock('./sync.service', () => ({
  default: SyncServiceCtorMock
}))

import SyncController from './sync.controller'

describe('SyncController', () => {
  it('crea una instancia de SyncService', () => {
    new SyncController()
    expect(SyncServiceCtorMock).toHaveBeenCalledTimes(1)
  })

  it('delegates all methods to SyncService preserving payload and response', async () => {
    const controller = new SyncController()

    const cases = [
      {
        controllerMethod: 'getSyncState',
        serviceMethod: 'getSyncState',
        payload: { workspaceId: 'ws-1', deviceId: 'pc-a' }
      },
      {
        controllerMethod: 'upsertSyncState',
        serviceMethod: 'upsertSyncState',
        payload: {
          workspaceId: 'ws-1',
          deviceId: 'pc-a',
          lastPulledAt: '2026-03-09T18:00:00.000Z',
          lastAckedChangeId: 9
        }
      },
      {
        controllerMethod: 'appendOutboxChange',
        serviceMethod: 'appendOutboxChange',
        payload: {
          workspaceId: 'ws-1',
          deviceId: 'pc-a',
          tableName: 'Song',
          recordId: '1',
          operation: SyncOperation.UPDATE,
          payload: JSON.stringify({ id: 1, title: 'Titulo' }),
          entityUpdatedAt: '2026-03-09T18:01:00.000Z'
        }
      },
      {
        controllerMethod: 'getPendingOutboxChanges',
        serviceMethod: 'getPendingOutboxChanges',
        payload: { workspaceId: 'ws-1', deviceId: 'pc-a', afterId: 2, limit: 10 }
      },
      {
        controllerMethod: 'acknowledgeOutboxChanges',
        serviceMethod: 'acknowledgeOutboxChanges',
        payload: { workspaceId: 'ws-1', deviceId: 'pc-a', upToId: 10 }
      },
      {
        controllerMethod: 'ingestRemoteChanges',
        serviceMethod: 'ingestRemoteChanges',
        payload: {
          workspaceId: 'ws-1',
          sourceDeviceId: 'pc-b',
          changes: [
            {
              remoteChangeId: 'r1',
              tableName: 'Song',
              recordId: '1',
              operation: SyncOperation.UPDATE,
              payload: JSON.stringify({ id: 1 }),
              entityUpdatedAt: '2026-03-09T18:02:00.000Z'
            }
          ]
        }
      },
      {
        controllerMethod: 'getPendingInboxChanges',
        serviceMethod: 'getPendingInboxChanges',
        payload: { workspaceId: 'ws-1', sourceDeviceId: 'pc-b', afterId: 3, limit: 20 }
      },
      {
        controllerMethod: 'markInboxChangesApplied',
        serviceMethod: 'markInboxChangesApplied',
        payload: { workspaceId: 'ws-1', ids: [1, 2, 3] }
      },
      {
        controllerMethod: 'applyPendingInboxBatch',
        serviceMethod: 'applyPendingInboxBatch',
        payload: { workspaceId: 'ws-1', sourceDeviceId: 'pc-b', limit: 50 }
      }
    ] as const

    for (const testCase of cases) {
      const expectedResponse = { ok: true, method: testCase.serviceMethod }
      serviceMethods[testCase.serviceMethod].mockResolvedValueOnce(expectedResponse)

      const result = await (controller as any)[testCase.controllerMethod](testCase.payload)

      expect(serviceMethods[testCase.serviceMethod]).toHaveBeenCalledWith(testCase.payload)
      expect(result).toEqual(expectedResponse)
    }
  })
})
