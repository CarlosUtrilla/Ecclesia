import path from 'path'
import fs from 'fs-extra'
import { load, save, type Doc } from '@automerge/automerge'
import { getSyncDir, writeJson, readJsonSafe } from './oplog-shared'
import type { OplogDocument, ReplayState, OplogConfig } from './oplog.types'
import { oplogLogInfo, oplogLogWarn } from './oplog-logger'

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
      const filePath = oplogFilePath()
      const buf = await fs.readFile(filePath)
      oplogLogInfo(`[OplogState] readOplogBinary: ${buf.length} bytes from ${filePath}`)
      return new Uint8Array(buf)
    } catch (e: any) {
      oplogLogInfo(`[OplogState] readOplogBinary: file not found (${e.message})`)
      return null
    }
  }

  async writeOplogBinary(data: Uint8Array): Promise<void> {
    await this.ensureSyncDir()
    const filePath = oplogFilePath()
    await fs.writeFile(filePath, Buffer.from(data))
    oplogLogInfo(`[OplogState] writeOplogBinary: ${data.length} bytes to ${filePath}`)
  }

  async deleteOplogBinary(): Promise<void> {
    try {
      const filePath = oplogFilePath()
      await fs.remove(filePath)
      oplogLogInfo(`[OplogState] deleteOplogBinary: removed ${filePath}`)
    } catch (e: any) {
      oplogLogInfo(`[OplogState] deleteOplogBinary: ${e.message}`)
    }
  }

  async readReplayState(): Promise<ReplayState | null> {
    const filePath = replayStateFilePath()
    const result = await readJsonSafe<ReplayState>(filePath)
    oplogLogInfo(`[OplogState] readReplayState: ${result ? JSON.stringify(result) : 'null'} from ${filePath}`)
    return result
  }

  async writeReplayState(state: ReplayState): Promise<void> {
    await this.ensureSyncDir()
    const filePath = replayStateFilePath()
    await writeJson(filePath, state)
    oplogLogInfo(`[OplogState] writeReplayState: to ${filePath}`)
  }

  async readConfig(): Promise<OplogConfig | null> {
    const filePath = configFilePath()
    const result = await readJsonSafe<OplogConfig>(filePath)
    oplogLogInfo(`[OplogState] readConfig: ${result ? JSON.stringify(result) : 'null'} from ${filePath}`)
    return result
  }

  async writeConfig(config: OplogConfig): Promise<void> {
    await this.ensureSyncDir()
    const filePath = configFilePath()
    await writeJson(filePath, config)
    oplogLogInfo(`[OplogState] writeConfig: to ${filePath}`)
  }
}

export const oplogStateService = new OplogStateService()
