import log from 'electron-log'
import path from 'path'
import fs from 'fs-extra'
import { getPrisma } from '../../prisma'
import { getMediaDir, getLocalMediaManifestPath, PersistedSyncConfig } from './sync.config'
import { writeJson } from './sync.utils'
import { syncMediaService } from './sync-media.service'
import { syncDriveOpsService } from './sync-drive-ops.service'

function scanDiskFiles(dir: string, prefix: string): Array<{ rel: string; abs: string; size: number }> {
  const results: Array<{ rel: string; abs: string; size: number }> = []
  let entries: string[]
  try { entries = fs.readdirSync(dir) } catch { return results }
  for (const entry of entries) {
    const absPath = path.join(dir, entry)
    const relPath = prefix ? `${prefix}/${entry}` : entry
    try {
      const stat = fs.statSync(absPath)
      if (stat.isDirectory()) results.push(...scanDiskFiles(absPath, relPath))
      else results.push({ rel: relPath, abs: absPath, size: stat.size })
    } catch { /* skip */ }
  }
  return results
}

export class SyncCleanupService {
  async cleanupOrphanMediaFromDiskAndDrive(
    drive: ReturnType<typeof import('googleapis').google.drive>,
    config: PersistedSyncConfig,
    appInstanceId: string,
    folderId: string
  ): Promise<{
    deletedOrphans: number
    deletedStale: number
    totalFreedBytes: number
    driveDeleted: number
    driveErrors: number
    details: Array<{ path: string; reason: string; size: number; driveDeleted: boolean }>
  }> {
    const prisma = getPrisma()
    const userMediaBase = getMediaDir()
    const filesRoot = path.join(userMediaBase, 'files')

    const allMedia = await prisma.media.findMany({
      select: { filePath: true, deletedAt: true, type: true, thumbnail: true, fallback: true }
    })

    const allFonts: Array<{ filePath: string | null; deletedAt: Date | null }> =
      prisma && (prisma as any).font && typeof (prisma as any).font.findMany === 'function'
        ? await (prisma as any).font.findMany({ select: { filePath: true, deletedAt: true } })
        : []

    const recordsByPath = new Map<string, Array<{ deletedAt: Date | null }>>()
    for (const m of allMedia) {
      if (!m.filePath) continue
      if (m.type !== 'IMAGE' && m.type !== 'VIDEO') continue
      const list = recordsByPath.get(m.filePath) || []
      list.push({ deletedAt: m.deletedAt })
      recordsByPath.set(m.filePath, list)
    }
    for (const f of allFonts) {
      if (!f.filePath) continue
      const list = recordsByPath.get(f.filePath) || []
      list.push({ deletedAt: f.deletedAt })
      recordsByPath.set(f.filePath, list)
    }

    const localManifest = await syncMediaService.buildLocalMediaManifest(config, appInstanceId)
    const manifestByPath = new Map(localManifest.entries.map(e => [e.path, e]))

    const diskFiles = scanDiskFiles(filesRoot, '')
    const details: Array<{ path: string; reason: string; size: number; driveDeleted: boolean }> = []
    let totalFreedBytes = 0
    let driveDeleted = 0
    let driveErrors = 0

    for (const file of diskFiles) {
      const dbPath = `files/${file.rel.replace(/\\/g, '/')}`
      const records = recordsByPath.get(dbPath)

      if (!records) {
        const driveOk = await this.deleteFromDriveIfExists(drive, manifestByPath, dbPath)
        if (driveOk) driveDeleted++
        else driveErrors++
        try { fs.unlinkSync(file.abs) } catch { /* skip */ }
        details.push({ path: dbPath, reason: 'orphan', size: file.size, driveDeleted: driveOk })
        totalFreedBytes += file.size
      } else {
        const allDeleted = records.every(r => r.deletedAt !== null)
        if (allDeleted) {
          const driveOk = await this.deleteFromDriveIfExists(drive, manifestByPath, dbPath)
          if (driveOk) driveDeleted++
          else driveErrors++
          try { fs.unlinkSync(file.abs) } catch { /* skip */ }
          details.push({ path: dbPath, reason: 'deleted-record', size: file.size, driveDeleted: driveOk })
          totalFreedBytes += file.size
        }
      }
    }

    const thumbDir = path.join(userMediaBase, 'thumbnails')
    if (fs.existsSync(thumbDir)) {
      const thumbFiles = scanDiskFiles(thumbDir, '')
      for (const file of thumbFiles) {
        const dbPath = `thumbnails/${file.rel.replace(/\\/g, '/')}`
        const isReferenced = allMedia.some(m => m.thumbnail === dbPath || m.fallback === dbPath)
        if (isReferenced) continue
        const driveOk = await this.deleteFromDriveIfExists(drive, manifestByPath, dbPath)
        if (driveOk) driveDeleted++
        else driveErrors++
        try { fs.unlinkSync(file.abs) } catch { /* skip */ }
        details.push({ path: dbPath, reason: 'orphan-thumbnail', size: file.size, driveDeleted: driveOk })
        totalFreedBytes += file.size
      }
    }

    const cleanedPaths = new Set(details.map(d => d.path))
    const updatedEntries = localManifest.entries.filter(e => !cleanedPaths.has(e.path))
    if (updatedEntries.length !== localManifest.entries.length) {
      const updatedManifest = {
        ...localManifest,
        updatedAt: new Date().toISOString(),
        entries: updatedEntries
      }
      await writeJson(getLocalMediaManifestPath(), updatedManifest)

      try {
        const remoteManifest = await syncMediaService.readRemoteMediaManifest(drive, config.workspaceId, folderId)
        if (remoteManifest) {
          const remoteEntries = (remoteManifest as any).entries?.filter((e: any) => !cleanedPaths.has(e.path)) || []
          await syncMediaService.writeRemoteMediaManifest(drive, config.workspaceId, {
            ...remoteManifest,
            updatedAt: new Date().toISOString(),
            entries: remoteEntries
          }, folderId)
        }
      } catch (err) {
        log.warn('[cleanup] Error actualizando manifest remoto:', err)
      }
    }

    // Phase 3: Scan Drive blobs and delete any not referenced in the remote manifest
    log.warn('[cleanup] Escaneando blobs en Drive para buscar huérfanos...')
    try {
      const remoteManifest = await syncMediaService.readRemoteMediaManifest(drive, config.workspaceId, folderId)
      const manifestChecksums = new Set<string>()
      if (remoteManifest) {
        for (const entry of remoteManifest.entries) {
          if (entry.checksum) manifestChecksums.add(entry.checksum)
        }
      }

      const driveBlobs = await syncMediaService.listRemoteMediaBlobs(drive, config.workspaceId, folderId)
      log.warn(`[cleanup] Blobs en Drive: ${driveBlobs.size}, checksums en manifest: ${manifestChecksums.size}`)

      for (const [checksum, fileId] of driveBlobs) {
        if (!manifestChecksums.has(checksum)) {
          try {
            await drive.files.delete({ fileId })
            driveDeleted++
            details.push({ path: `blob:${checksum.slice(0, 12)}...`, reason: 'orphan-drive-blob', size: 0, driveDeleted: true })
            log.warn(`[cleanup] Blob huérfano eliminado de Drive: checksum=${checksum.slice(0, 12)}..., fileId=${fileId}`)
          } catch (err) {
            if (syncDriveOpsService.isDriveNotFoundError(err)) {
              driveDeleted++
            } else {
              driveErrors++
              log.warn(`[cleanup] Error eliminando blob huérfano de Drive: checksum=${checksum.slice(0, 12)}..., fileId=${fileId}:`, err)
            }
          }
        }
      }
    } catch (err) {
      log.warn('[cleanup] Error escaneando blobs en Drive:', err)
    }

    const deletedOrphans = details.filter(d => d.reason === 'orphan' || d.reason === 'orphan-thumbnail').length
    const deletedStale = details.filter(d => d.reason === 'deleted-record').length

    return { deletedOrphans, deletedStale, totalFreedBytes, driveDeleted, driveErrors, details }
  }

  private async deleteFromDriveIfExists(
    drive: ReturnType<typeof import('googleapis').google.drive>,
    manifestByPath: Map<string, { driveFileId?: string | null }>,
    filePath: string
  ): Promise<boolean> {
    const entry = manifestByPath.get(filePath)
    const fileId = entry?.driveFileId
    if (!fileId) return false
    try {
      await drive.files.delete({ fileId })
      return true
    } catch (err) {
      if (syncDriveOpsService.isDriveNotFoundError(err)) return true
      log.warn(`[cleanup] Error al eliminar de Drive ${filePath}:`, err)
      return false
    }
  }
}

export const syncCleanupService = new SyncCleanupService()
