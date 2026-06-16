import { drive_v3 } from 'googleapis'
import {
  getLocalMediaManifestPath,
  MediaManifestFile
} from './sync.config'
import { readJsonSafe } from './sync.utils'
import { syncMediaService } from './sync-media.service'
import { driveClientService } from './sync-drive-client.service'

export class SyncLazyFetchService {
  async lazyFetchMediaFromDrive(relativePath: string): Promise<boolean> {
    let workspaceId: string | undefined
    let checksum: string | null = null
    let driveFileId: string | null = null

    const localManifest = await readJsonSafe<MediaManifestFile>(getLocalMediaManifestPath())
    const localEntry = localManifest?.entries.find((e) => e.path === relativePath)
    if (localEntry?.checksum) {
      workspaceId = localManifest!.workspaceId
      checksum = localEntry.checksum
      driveFileId = localEntry.driveFileId ?? null
      console.warn(
        `[lazy-fetch] Local: ${relativePath} ws=${workspaceId} cksum=${checksum.slice(0, 12)} deletedAt=${localEntry.deletedAt ?? 'null'} driveFileId=${driveFileId ?? 'null'}`
      )
    }

    let drive: drive_v3.Drive
    try {
      drive = await driveClientService.getDriveClientFromTokensOnly()
    } catch {
      try {
        const client = await driveClientService.getDriveClient()
        drive = client.drive
        workspaceId ??= client.config.workspaceId
      } catch {
        console.warn(`[lazy-fetch] Sin acceso a Drive: ${relativePath}`)
        return false
      }
    }

    workspaceId ??= localManifest?.workspaceId
    if (!workspaceId) {
      console.warn(`[lazy-fetch] Sin workspaceId: ${relativePath}`)
      return false
    }

    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)

    if (checksum && !driveFileId) {
      console.warn(`[lazy-fetch] Sin driveFileId en local, buscando en remoto (ws=${workspaceId})...`)
      try {
        const remoteManifest = await syncMediaService.readRemoteMediaManifest(drive, workspaceId, folderId)
        const remoteEntry = remoteManifest?.entries.find((e) => e.path === relativePath)
        if (remoteEntry?.driveFileId) {
          driveFileId = remoteEntry.driveFileId
          if (remoteEntry.checksum) checksum = remoteEntry.checksum
          console.warn(`[lazy-fetch] Remoto: driveFileId=${driveFileId} cksum=${checksum.slice(0, 12)}`)
        } else if (remoteEntry?.checksum && remoteEntry.checksum !== checksum) {
          checksum = remoteEntry.checksum
          console.warn(`[lazy-fetch] Checksum remoto diferente: ${checksum.slice(0, 12)}`)
        } else {
          console.warn(`[lazy-fetch] Remoto: sin driveFileId, mismo cksum que local`)
        }
      } catch (e) {
        console.warn(`[lazy-fetch] Error leyendo remoto: ${(e as Error).message}`)
      }
    }

    if (!checksum) {
      console.warn(`[lazy-fetch] No en local, consultando remoto (ws=${workspaceId}): ${relativePath}`)
      const remoteManifest = await syncMediaService.readRemoteMediaManifest(drive, workspaceId, folderId)
      const remoteEntry = remoteManifest?.entries.find((e) => e.path === relativePath)
      if (!remoteEntry?.checksum) {
        console.warn(`[lazy-fetch] No encontrado en remoto: ${relativePath}`)
        return false
      }
      checksum = remoteEntry.checksum
      driveFileId = remoteEntry.driveFileId ?? null
      console.warn(`[lazy-fetch] Remoto: ${relativePath} cksum=${checksum.slice(0, 12)} driveFileId=${driveFileId ?? 'null'}`)
    }

    if (driveFileId) {
      try {
        console.warn(`[lazy-fetch] Descargando driveFileId=${driveFileId}: ${relativePath}`)
        await syncMediaService.downloadAndVerifyBlobChecksum(drive, driveFileId, relativePath, checksum)
        console.warn(`[lazy-fetch] Listo: ${relativePath}`)
        return true
      } catch (e) {
        console.warn(`[lazy-fetch] driveFileId falló: ${(e as Error).message}`)
      }
    }

    console.warn(`[lazy-fetch] Buscando blob por checksum: ${checksum.slice(0, 12)}...`)
    const blobsByChecksum = await syncMediaService.listRemoteMediaBlobs(drive, workspaceId, folderId)
    const fileId = blobsByChecksum.get(checksum)
    if (!fileId) {
      console.warn(`[lazy-fetch] Blob no encontrado en Drive: ${checksum.slice(0, 12)}`)
      return false
    }

    console.warn(`[lazy-fetch] Descargando blob ${fileId}: ${relativePath}`)
    await syncMediaService.downloadAndVerifyBlobChecksum(drive, fileId, relativePath, checksum)
    console.warn(`[lazy-fetch] Listo: ${relativePath}`)
    return true
  }
}

export const syncLazyFetchService = new SyncLazyFetchService()
