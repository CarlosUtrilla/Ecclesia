import { beforeEach, describe, expect, it, vi } from 'vitest'

const filesList = vi.fn()
const filesGet = vi.fn()

vi.mock('./oplog-drive-client.service', () => ({
  driveClientService: {
    getDriveClientFromTokensOnly: vi.fn(async () => ({ files: { list: filesList, get: filesGet } })),
    getOrCreateEcclesiaFolder: vi.fn(async () => 'folder-1')
  }
}))

vi.mock('./oplog-logger', () => ({
  oplogLogInfo: vi.fn(),
  oplogLogWarn: vi.fn(),
  oplogLogError: vi.fn()
}))

const { oplogDriveService } = await import('./oplog-drive.service')

const REMOTE_GENERATION = 7526

/** Metadatos del archivo remoto; el cuerpo solo llega con `alt: 'media'`. */
function stubDrive() {
  filesList.mockResolvedValue({ data: { files: [{ id: 'file-1', headRevisionId: `r${REMOTE_GENERATION}` }] } })
  filesGet.mockImplementation(async (params: Record<string, unknown>) => {
    if (params.alt === 'media') return { data: new ArrayBuffer(1893762) }
    return { data: { id: 'file-1', headRevisionId: `r${REMOTE_GENERATION}` } }
  })
}

const bodyRequests = () => filesGet.mock.calls.filter(([params]) => params?.alt === 'media').length

describe('downloadOplog: corte por generación', () => {
  beforeEach(() => {
    filesList.mockReset()
    filesGet.mockReset()
    stubDrive()
  })

  it('no descarga el cuerpo cuando la generación remota es la ya conocida', async () => {
    const result = await oplogDriveService.downloadOplog(REMOTE_GENERATION)

    expect(result?.generation).toBe(REMOTE_GENERATION)
    expect(result?.data).toBeNull()
    // Lo que importa: sin cuerpo no hay `load()` ni `merge()` de Automerge,
    // que son síncronos y bloquean el proceso main.
    expect(bodyRequests()).toBe(0)
  })

  it('descarga cuando la generación remota ha cambiado', async () => {
    const result = await oplogDriveService.downloadOplog(REMOTE_GENERATION - 1)

    expect(result?.data).toBeInstanceOf(Uint8Array)
    expect(bodyRequests()).toBe(1)
  })

  it('descarga cuando no se pasa generación conocida', async () => {
    const result = await oplogDriveService.downloadOplog()

    expect(result?.data).toBeInstanceOf(Uint8Array)
    expect(bodyRequests()).toBe(1)
  })

  it('descarga cuando la generación conocida es 0 (sin push previo)', async () => {
    const result = await oplogDriveService.downloadOplog(0)

    expect(result?.data).toBeInstanceOf(Uint8Array)
    expect(bodyRequests()).toBe(1)
  })

  it('devuelve null cuando no hay archivo remoto', async () => {
    filesList.mockResolvedValue({ data: { files: [] } })

    expect(await oplogDriveService.downloadOplog(REMOTE_GENERATION)).toBeNull()
  })
})
