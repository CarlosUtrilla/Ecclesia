export type EntityType =
  | 'song'
  | 'tagSongs'
  | 'biblePresentationSettings'
  | 'media'
  | 'font'
  | 'themes'
  | 'presentation'
  | 'setting'
  | 'schedule'
  | 'scheduleGroupTemplate'
  | 'scheduleItem'
  | 'selectedScreens'
  | 'stageScreenConfig'

export const ENTITY_TYPE_TO_PRISMA_MODEL: Record<EntityType, string> = {
  song: 'Song',
  tagSongs: 'TagSongs',
  biblePresentationSettings: 'BiblePresentationSettings',
  media: 'Media',
  font: 'Font',
  themes: 'Themes',
  presentation: 'Presentation',
  setting: 'Setting',
  schedule: 'Schedule',
  scheduleGroupTemplate: 'ScheduleGroupTemplate',
  scheduleItem: 'ScheduleItem',
  selectedScreens: 'SelectedScreens',
  stageScreenConfig: 'StageScreenConfig',
}

export type OplogOperation = 'upsert' | 'delete'

export interface OplogEvent {
  id: string
  seq: number
  deviceId: string
  timestamp: number
  entityType: EntityType
  entityId: string
  op: OplogOperation
  data?: Record<string, unknown>
  checksum?: string
  thumbnailChecksum?: string
  fallbackChecksum?: string
  blobSize?: number
  blobMimeType?: string
  blobPath?: string
  thumbnailBlobPath?: string
  fallbackBlobPath?: string
}

export interface OplogDocument {
  [key: string]: unknown
  schemaVersion: 1
  schemaHash: string
  createdAt: number
  ops: OplogEvent[]
  /**
   * Ids de ops podados → timestamp de la poda. Sin ellos, la unión con el oplog
   * de otro dispositivo devolvería los ops borrados (ver `oplog-doc.ts`).
   */
  tombstones: Record<string, number>
  snapshot?: {
    takenAt: number
    takenFrom: Array<{ deviceId: string; seq: number }>
    entities: Record<string, Record<string, Record<string, unknown>>>
  }
}

export interface ReplayState {
  lastAppliedIndex: number
  lastAppliedEventId: string | null
  snapshotAppliedAt: number | null
  appliedAt: string | null
}

export interface OplogConfig {
  deviceId: string
  deviceName: string
  lastPushAt: string | null
  lastPullAt: string | null
  lastSyncAt: string | null
  lastRemoteGeneration: number | null
  lastPurgeAt: string | null
  /**
   * Hash de contenido (`oplogContentHash`) del doc tal y como quedó en el último
   * push correcto, en un array de un elemento (antes eran las heads de Automerge).
   * Permite saber si hay algo local sin subir sin tener que marcar todos los
   * eventos como pendientes en cada arranque.
   */
  lastPushedHeads?: string[] | null
  /**
   * Generación del archivo v1 de Drive (`ecclesia-oplog.bin`) ya incorporada. Mientras
   * un equipo sin actualizar siga escribiéndolo, cada pull lo trae y lo une al v2.
   */
  lastLegacyGeneration?: number | null
}

export interface SyncCycleResult {
  pulled: number
  pushed: number
  blobsDownloaded: number
  blobsUploaded: number
  errors: string[]
}

export interface SyncProgress {
  phase: 'pull' | 'push' | 'blob' | 'gc' | 'purge' | 'idle'
  progress: number
  message: string
}

export type BlobOperation =
  | { type: 'download'; checksum: string; path: string }
  | { type: 'upload'; checksum: string; localPath: string }
  | { type: 'delete'; checksum: string; path: string }
  | { type: 'move'; checksum: string; oldPath: string; newPath: string }
