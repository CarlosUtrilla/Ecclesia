import path from 'path'
import fs from 'fs-extra'
import { load, save, type Doc } from '@automerge/automerge'
import { getSyncDir } from '../sync/sync.config'
import { writeJson, readJsonSafe } from '../sync/sync.utils'
import type { OplogDocument, ReplayState, OplogConfig } from './oplog.types'

const OPLOG_FILE_NAME = 'oplog.bin'
const REPLAY_STATE_FILE_NAME = 'oplog-replay-state.json'
const OPLOG_CONFIG_FILE_NAME = 'oplog-config.json'

function oplogFilePath(): string {
  return path.join(getSyncDir(), OPLOG_FILE_NAME)
}

function replayStateFilePath(): string {
  return path.join(getSyncDir(), REPLAY_STATE_FILE_NAME)
}

function configFilePath(): string {
  return path.join(getSyncDir(), OPLOG_CONFIG_FILE_NAME)
}

export class OplogStateService {
  async ensureSyncDir(): Promise<void> {
    await fs.ensureDir(getSyncDir())
  }

  async readOplogBinary(): Promise<Uint8Array | null> {
    try {
      const buf = await fs.readFile(oplogFilePath())
      return new Uint8Array(buf)
    } catch {
      return null
    }
  }

  async writeOplogBinary(data: Uint8Array): Promise<void> {
    await this.ensureSyncDir()
    await fs.writeFile(oplogFilePath(), Buffer.from(data))
  }

  async deleteOplogBinary(): Promise<void> {
    try {
      await fs.remove(oplogFilePath())
    } catch { /* ignore */ }
  }

  async readReplayState(): Promise<ReplayState | null> {
    return readJsonSafe<ReplayState>(replayStateFilePath())
  }

  async writeReplayState(state: ReplayState): Promise<void> {
    await this.ensureSyncDir()
    await writeJson(replayStateFilePath(), state)
  }

  async readConfig(): Promise<OplogConfig | null> {
    return readJsonSafe<OplogConfig>(configFilePath())
  }

  async writeConfig(config: OplogConfig): Promise<void> {
    await this.ensureSyncDir()
    await writeJson(configFilePath(), config)
  }
}

export const oplogStateService = new OplogStateService()
