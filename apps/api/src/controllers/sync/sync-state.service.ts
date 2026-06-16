import { getStateFilePath, SyncState, buildRetryBackoffState } from './sync.config'
import { readJsonSafe, writeJson } from './sync.utils'

export class SyncStateService {
  async getState(): Promise<SyncState> {
    return (await readJsonSafe<SyncState>(getStateFilePath())) || {}
  }

  async updateState(patch: SyncState): Promise<SyncState> {
    const state = await this.getState()
    const nextState: SyncState = { ...state, ...patch }
    await writeJson(getStateFilePath(), nextState)
    return nextState
  }

  async recordError(error: unknown, reason: string): Promise<void> {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    await this.updateState({
      lastRunAt: new Date().toISOString(),
      lastRunReason: reason as any,
      lastRunStatus: 'error',
      lastRunError: message
    })
  }

  async recordSuccess(reason: string): Promise<void> {
    await this.updateState({
      lastRunAt: new Date().toISOString(),
      lastRunReason: reason as any,
      lastRunStatus: 'ok',
      lastRunError: undefined,
      retryCount: 0,
      nextRetryAt: undefined
    })
  }

  async getNextRetryState(currentRetryCount = 0) {
    return buildRetryBackoffState(currentRetryCount)
  }
}

export const syncStateService = new SyncStateService()
