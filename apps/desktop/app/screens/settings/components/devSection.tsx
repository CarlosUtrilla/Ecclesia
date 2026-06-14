import { useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Bug,
  CheckCircle2,
  ListChecks,
  Search,
  Trash2,
  Wrench
} from 'lucide-react'
import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'


type DiagnosticSummary = {
  total: number
  ok: number
  needUpload: number
  needDownload: number
  orphanLocal: number
  tombstoned: number
  totalSizeBytes: number
}

type DiagnosticDetail = {
  path: string
  size: number
  localChecksum: string | null
  remoteChecksum: string | null
  localExists: boolean
  remoteBlobExists: boolean
  isTombstone: boolean
  issue: 'ok' | 'missing-locally' | 'missing-in-drive' | 'orphan-local' | 'tombstoned'
}

type SyncDiagnostic = {
  workspaceId: string
  fetchedAt: string
  summary: DiagnosticSummary
  details: DiagnosticDetail[]
}

export default function DevSection() {
  const [statusMessage, setStatusMessage] = useState('')
  const [diagnostic, setDiagnostic] = useState<SyncDiagnostic | null>(null)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [isHealing, setIsHealing] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{
    deletedOrphans: number
    deletedStale: number
    totalFreedBytes: number
    driveDeleted: number
    driveErrors: number
    details: Array<{ path: string; reason: string; size: number; driveDeleted: boolean }>
  } | null>(null)
  const [isCleaning, setIsCleaning] = useState(false)

  const handleDiagnose = async () => {
    setIsDiagnosing(true)
    setDiagnostic(null)
    setStatusMessage('Analizando archivos locales vs Google Drive...')
    try {
      const result = await window.googleDriveSyncAPI.diagnoseNow()
      setDiagnostic(result as SyncDiagnostic)
      const s = (result as SyncDiagnostic).summary
      if (s.ok === s.total) {
        setStatusMessage(`Todo en orden: ${s.total} archivos sincronizados correctamente`)
      } else {
        const partes: string[] = []
        if (s.needUpload > 0) partes.push(`${s.needUpload} por subir`)
        if (s.needDownload > 0) partes.push(`${s.needDownload} por descargar`)
        if (s.orphanLocal > 0) partes.push(`${s.orphanLocal} huérfanos`)
        if (s.tombstoned > 0) partes.push(`${s.tombstoned} eliminados`)
        setStatusMessage(`Diagnóstico: ${s.ok}/${s.total} OK — ${partes.join(', ')}`)
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Error en diagnóstico')
    } finally {
      setIsDiagnosing(false)
    }
  }

  const handleCleanup = async () => {
    const confirmed = window.confirm(
      'Esto eliminará archivos de medios que no están vinculados en la base de datos y archivos de registros eliminados. ¿Continuar?'
    )
    if (!confirmed) return

    setIsCleaning(true)
    setCleanupResult(null)
    setStatusMessage('Escaneando y limpiando archivos...')
    try {
      const result = await window.googleDriveSyncAPI.cleanupMediaOrphans()
      setCleanupResult(result as typeof cleanupResult)
      const mb = (result.totalFreedBytes / (1024 * 1024)).toFixed(2)
      setStatusMessage(
        `Limpieza completada: ${result.deletedOrphans} huérfanos y ${result.deletedStale} obsoletos eliminados (${mb} MB liberados)`
      )
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Error en limpieza')
    } finally {
      setIsCleaning(false)
    }
  }

  const handleHeal = async () => {
    if (!diagnostic) {
      setStatusMessage('Ejecuta el diagnóstico primero')
      return
    }

    setIsHealing(true)
    setStatusMessage('Reparando discrepancias...')
    try {
      const result = await window.googleDriveSyncAPI.healNow(diagnostic) as {
        uploaded: number
        downloaded: number
        errors: Array<{ path: string; error: string }>
      }
      const partes: string[] = []
      if (result.uploaded > 0) partes.push(`${result.uploaded} subidos`)
      if (result.downloaded > 0) partes.push(`${result.downloaded} descargados`)
      if (result.errors.length > 0) partes.push(`${result.errors.length} errores`)
      setStatusMessage(`Reparación completada: ${partes.join(', ') || 'sin cambios'}`)
      setDiagnostic(null)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Error en reparación')
    } finally {
      setIsHealing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="size-4" /> Dev
        </CardTitle>
        <CardDescription>
          Utilidades de desarrollo y diagnóstico.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Sincronización Google Drive</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDiagnosing || isHealing}
              onClick={handleDiagnose}
            >
              <Search className="size-4" />
              {isDiagnosing ? 'Analizando...' : 'Diagnosticar'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isHealing || !diagnostic || diagnostic.summary.ok === diagnostic.summary.total}
              onClick={handleHeal}
            >
              <Wrench className="size-4" />
              {isHealing ? 'Reparando...' : 'Reparar'}
            </Button>
          </div>

          {diagnostic ? (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-sm">
                <ListChecks className="size-3.5" />
                Resultado del diagnóstico
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-green-600" />
                  <span>{diagnostic.summary.ok} correctos</span>
                </div>
                {diagnostic.summary.needUpload > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <ArrowUpFromLine className="size-3.5 text-amber-600" />
                    <span>{diagnostic.summary.needUpload} por subir</span>
                  </div>
                ) : null}
                {diagnostic.summary.needDownload > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <ArrowDownToLine className="size-3.5 text-amber-600" />
                    <span>{diagnostic.summary.needDownload} por descargar</span>
                  </div>
                ) : null}
                {diagnostic.summary.orphanLocal > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 text-muted-foreground" />
                    <span>{diagnostic.summary.orphanLocal} huérfanos</span>
                  </div>
                ) : null}
                {diagnostic.summary.tombstoned > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 text-muted-foreground" />
                    <span>{diagnostic.summary.tombstoned} eliminados</span>
                  </div>
                ) : null}
              </div>
              {diagnostic.details.filter((d) => d.issue !== 'ok' && d.issue !== 'tombstoned')
                .length > 0 ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Ver archivos con problemas ({diagnostic.details.filter((d) => d.issue !== 'ok' && d.issue !== 'tombstoned').length})
                  </summary>
                  <div className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
                    {diagnostic.details
                      .filter((d) => d.issue !== 'ok' && d.issue !== 'tombstoned')
                      .map((d) => (
                        <div
                          key={d.path}
                          className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-muted/50"
                        >
                          <span className="truncate max-w-[280px]">{d.path}</span>
                          <span
                            className={
                              d.issue === 'missing-in-drive'
                                ? 'text-amber-600 font-medium'
                                : d.issue === 'missing-locally'
                                  ? 'text-red-600 font-medium'
                                  : 'text-muted-foreground'
                            }
                          >
                            {d.issue === 'missing-in-drive'
                              ? 'Falta en Drive'
                              : d.issue === 'missing-locally'
                                ? 'Falta localmente'
                                : 'Huérfano'}
                          </span>
                        </div>
                      ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          {statusMessage ? (
            <p className="text-xs text-muted-foreground">{statusMessage}</p>
          ) : null}
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center gap-2">
            <Trash2 className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Limpieza de archivos huérfanos</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={isCleaning}
              onClick={handleCleanup}
            >
              <Trash2 className="size-4" />
              {isCleaning ? 'Limpiando...' : 'Limpiar archivos no vinculados'}
            </Button>
          </div>

          {cleanupResult ? (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Trash2 className="size-3.5" />
                Resultado de limpieza
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5">
                  <Trash2 className="size-3.5 text-red-600" />
                  <span>{cleanupResult.deletedOrphans} huérfanos eliminados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trash2 className="size-3.5 text-amber-600" />
                  <span>{cleanupResult.deletedStale} obsoletos eliminados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-green-600" />
                  <span>{(cleanupResult.totalFreedBytes / (1024 * 1024)).toFixed(2)} MB liberados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  <span>{cleanupResult.driveDeleted} eliminados de Drive</span>
                </div>
                {cleanupResult.driveErrors > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 text-destructive" />
                    <span>{cleanupResult.driveErrors} errores en Drive</span>
                  </div>
                ) : null}
              </div>
              {cleanupResult.details.length > 0 ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Ver archivos eliminados ({cleanupResult.details.length})
                  </summary>
                  <div className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
                    {cleanupResult.details.map((d) => (
                      <div
                        key={d.path}
                        className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-muted/50"
                      >
                        <span className="truncate max-w-[280px]">{d.path}</span>
                        <div className="flex items-center gap-2">
                          {d.driveDeleted ? (
                            <CheckCircle2 className="size-3 shrink-0 text-primary" />
                          ) : null}
                          <span className={d.reason === 'orphan' || d.reason === 'orphan-thumbnail' ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                            {d.reason === 'orphan' || d.reason === 'orphan-thumbnail' ? 'Huérfano' : 'Registro eliminado'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
