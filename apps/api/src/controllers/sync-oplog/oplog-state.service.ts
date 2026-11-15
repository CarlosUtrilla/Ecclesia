import path from 'path'
import fs from 'fs-extra'
import { getSyncDir, writeJson, readJsonSafe } from './oplog-shared'
import type { ReplayState, OplogConfig } from './oplog.types'
import { oplogLogInfo, oplogLogWarn } from './oplog-logger'

// v2: JSON gzip (`oplog-doc.ts`). v1: binario de Automerge; solo se lee para migrar y
// después se conserva renombrado como respaldo, nunca se borra.
const OPLOG_FILE_NAME = 'oplog-v2.json.gz'
const LEGACY_OPLOG_FILE_NAME = 'oplog.bin'
const LEGACY_OPLOG_BACKUP_FILE_NAME = 'oplog.v1.bak.bin'
const REPLAY_STATE_FILE_NAME = 'oplog-replay-state.json'
const OPLOG_CONFIG_FILE_NAME = 'oplog-config.json'

function oplogFilePath(): string {
  return path.join(getSyncDir(), OPLOG_FILE_NAME)
}

function legacyOplogFilePath(): string {
  return path.join(getSyncDir(), LEGACY_OPLOG_FILE_NAME)
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

  /** Lee el oplog v2 y, si aún no existe, el v1 de Automerge para migrarlo. */
  async readOplogBinary(): Promise<Uint8Array | null> {
    for (const filePath of [oplogFilePath(), legacyOplogFilePath()]) {
      try {
        const buf = await fs.readFile(filePath)
        oplogLogInfo(`[OplogState] readOplogBinary: ${buf.length} bytes from ${filePath}`)
        return new Uint8Array(buf)
      } catch (e: any) {
        oplogLogInfo(`[OplogState] readOplogBinary: ${filePath} not found (${e.message})`)
      }
    }
    return null
  }

  async writeOplogBinary(data: Uint8Array): Promise<void> {
    await this.ensureSyncDir()
    const filePath = oplogFilePath()
    // Escritura atómica: un cierre a mitad de escritura no deja un oplog truncado.
    // Nombre único: persistLocal() y el persist diferido pueden escribir a la vez.
    const tmpPath = `${filePath}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`
    await fs.writeFile(tmpPath, Buffer.from(data))
    await fs.move(tmpPath, filePath, { overwrite: true })
    oplogLogInfo(`[OplogState] writeOplogBinary: ${data.length} bytes to ${filePath}`)
    await this.retireLegacyOplog()
  }

  /**
   * Borra el oplog v2. El v1 nunca se elimina: se aparta como respaldo para que un
   * fallo al leerlo (no necesariamente corrupción) no destruya la historia.
   */
  async deleteOplogBinary(): Promise<void> {
    try {
      const filePath = oplogFilePath()
      await fs.remove(filePath)
      oplogLogInfo(`[OplogState] deleteOplogBinary: removed ${filePath}`)
    } catch (e: any) {
      oplogLogInfo(`[OplogState] deleteOplogBinary: ${e.message}`)
    }
    await this.retireLegacyOplog()
  }

  /** Renombra `oplog.bin` a su respaldo una vez que el v2 ya existe en disco. */
  private async retireLegacyOplog(): Promise<void> {
    const legacyPath = legacyOplogFilePath()
    if (!(await fs.pathExists(legacyPath))) return
    const backupPath = path.join(getSyncDir(), LEGACY_OPLOG_BACKUP_FILE_NAME)
    try {
      await fs.move(legacyPath, backupPath, { overwrite: false })
      oplogLogInfo(`[OplogState] oplog v1 conservado como respaldo en ${backupPath}`)
    } catch (e: any) {
      oplogLogWarn(`[OplogState] No se pudo apartar el oplog v1: ${e.message}`)
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
