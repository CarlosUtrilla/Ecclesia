import { RequestHandler } from '../../utils/RequestHandler'
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

  async getSyncState({ body }: RequestHandler<SyncStateDTO>) {
    return await this.syncService.getSyncState(body)
  }

  async upsertSyncState({ body }: RequestHandler<UpsertSyncStateDTO>) {
    return await this.syncService.upsertSyncState(body)
  }

  async appendOutboxChange({ body }: RequestHandler<AppendOutboxChangeDTO>) {
    return await this.syncService.appendOutboxChange(body)
  }

  async getPendingOutboxChanges({ body }: RequestHandler<PendingOutboxChangesDTO>) {
    return await this.syncService.getPendingOutboxChanges(body)
  }

  async acknowledgeOutboxChanges({ body }: RequestHandler<AckOutboxChangesDTO>) {
    return await this.syncService.acknowledgeOutboxChanges(body)
  }

  async ingestRemoteChanges({ body }: RequestHandler<IngestRemoteChangesDTO>) {
    return await this.syncService.ingestRemoteChanges(body)
  }

  async getPendingInboxChanges({ body }: RequestHandler<PendingInboxChangesDTO>) {
    return await this.syncService.getPendingInboxChanges(body)
  }

  async markInboxChangesApplied({ body }: RequestHandler<MarkInboxAppliedDTO>) {
    return await this.syncService.markInboxChangesApplied(body)
  }

  async applyPendingInboxBatch({ body }: RequestHandler<ApplyPendingInboxBatchDTO>) {
    return await this.syncService.applyPendingInboxBatch(body)
  }
}

export default SyncController
