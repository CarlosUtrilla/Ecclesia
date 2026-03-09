import {
  ApplyPendingInboxBatchDTO,
  AckOutboxChangesDTO,
  AppendOutboxChangeDTO,
  IngestRemoteChangesDTO,
  MarkInboxAppliedDTO,
  PendingInboxChangesDTO,
  PendingOutboxChangesDTO,
  SyncStateDTO,
  UpsertSyncStateDTO
} from './sync.dto'
import SyncService from './sync.service'

class SyncController {
  private syncService = new SyncService()

  async getSyncState(data: SyncStateDTO) {
    return await this.syncService.getSyncState(data)
  }

  async upsertSyncState(data: UpsertSyncStateDTO) {
    return await this.syncService.upsertSyncState(data)
  }

  async appendOutboxChange(data: AppendOutboxChangeDTO) {
    return await this.syncService.appendOutboxChange(data)
  }

  async getPendingOutboxChanges(data: PendingOutboxChangesDTO) {
    return await this.syncService.getPendingOutboxChanges(data)
  }

  async acknowledgeOutboxChanges(data: AckOutboxChangesDTO) {
    return await this.syncService.acknowledgeOutboxChanges(data)
  }

  async ingestRemoteChanges(data: IngestRemoteChangesDTO) {
    return await this.syncService.ingestRemoteChanges(data)
  }

  async getPendingInboxChanges(data: PendingInboxChangesDTO) {
    return await this.syncService.getPendingInboxChanges(data)
  }

  async markInboxChangesApplied(data: MarkInboxAppliedDTO) {
    return await this.syncService.markInboxChangesApplied(data)
  }

  async applyPendingInboxBatch(data: ApplyPendingInboxBatchDTO) {
    return await this.syncService.applyPendingInboxBatch(data)
  }
}

export default SyncController
