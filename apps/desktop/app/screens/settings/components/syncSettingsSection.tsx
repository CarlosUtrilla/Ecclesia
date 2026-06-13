import { useCallback, useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Download,
  Link2,
  ListChecks,
  Search,
  Upload,
  Wrench
} from 'lucide-react'
import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/card'
import { Badge } from '@/ui/badge'
import { Label } from '@/ui/label'
import { Input } from '@/ui/input'
import { Switch } from '@/ui/switch'
import { SyncSettingsForm, SyncSettingsSchema } from '../schema'

const SYNC_SETTINGS_KEY = 'ecclesia-sync-settings'

type SyncStatus = {
  connected: boolean
  accountEmail?: string
  accountName?: string
  pendingRestore: boolean
  workspaceId?: string
  deviceName?: string
  systemHostname?: string
  lastSyncAt?: string
  lastRunStatus?: 'ok' | 'error'
  lastRunError?: string
  lastRunAt?: string
  pendingOutboxChanges?: number
  pendingInboxChanges?: number
}

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


const getStoredSyncSettings = (): SyncSettingsForm => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY) || '{}')
    const result = SyncSettingsSchema.safeParse(parsed)
    if (result.success) {
      return result.data
    }
  } catch {
    // noop
  }

  return {
    enabled: false,
    workspaceId: '',
    deviceName: '',
    conflictStrategy: 'lastWriteWins',
    primaryDeviceName: '',
    autoOnStart: true,
    autoEvery5Min: true,
    autoOnSave: true,
    autoOnClose: true
  }
}

export default function SyncSettingsSection() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [diagnostic, setDiagnostic] = useState<SyncDiagnostic | null>(null)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [isHealing, setIsHealing] = useState(false)
  const storedSettings = useMemo(() => getStoredSyncSettings(), [])

  const syncForm = useForm<SyncSettingsForm>({
    resolver: zodResolver(SyncSettingsSchema),
    mode: 'onChange',
    defaultValues: storedSettings
  })

  const isSyncEnabled = syncForm.watch('enabled')

  const persistSyncSettings = useCallback(async (values: SyncSettingsForm) => {
    localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(values))
    // No enviamos `enabled` — ese campo solo lo gestiona connect/disconnect
    const { enabled: _enabled, ...configWithoutEnabled } = values
    await window.googleDriveSyncAPI.configure(configWithoutEnabled as SyncSettingsForm)
  }, [])

  const refreshStatus = async () => {
    const nextStatus = await window.googleDriveSyncAPI.getStatus()
    setStatus(nextStatus)
    return nextStatus
  }

  const handleConnectGoogleDrive = syncForm.handleSubmit(async (values) => {
    setIsProcessing(true)
    setStatusMessage('Abriendo autenticación de Google...')
    try {
      persistSyncSettings(values)
      await window.googleDriveSyncAPI.connect({
        enabled: values.enabled,
        workspaceId: values.workspaceId,
        deviceName: values.deviceName,
        conflictStrategy: values.conflictStrategy,
        primaryDeviceName: values.primaryDeviceName,
        autoOnStart: values.autoOnStart,
        autoEvery5Min: values.autoEvery5Min,
        autoOnSave: values.autoOnSave,
        autoOnClose: values.autoOnClose
      })
      await refreshStatus()
      setStatusMessage('Google Drive conectado correctamente')
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'No se pudo conectar con Google Drive'
      )
    } finally {
      setIsProcessing(false)
    }
  })

  const handleSyncNow = syncForm.handleSubmit(async (values) => {
    if (!status?.connected) {
      setStatusMessage('Conecta Google Drive para sincronizar ahora')
      return
    }

    setIsProcessing(true)
    setStatusMessage('Sincronizando con Google Drive...')
    try {
      persistSyncSettings(values)
      await window.googleDriveSyncAPI.pushNow()
      await refreshStatus()
      setStatusMessage('Sincronización completada')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo sincronizar ahora')
    } finally {
      setIsProcessing(false)
    }
  })

  const handleDisconnect = async () => {
    setIsProcessing(true)
    try {
      await window.googleDriveSyncAPI.disconnect()
      await refreshStatus()
      setStatusMessage('Sesión de Google Drive cerrada')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo cerrar sesión')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePushBackup = async () => {
    if (!status?.connected || !isSyncEnabled) {
      setStatusMessage('Activa la sincronización y conecta Google Drive para subir respaldo')
      return
    }

    setIsProcessing(true)
    setStatusMessage('Reconciliando cambios y subiendo respaldo a Google Drive...')
    try {
      await window.googleDriveSyncAPI.reconcileNow()
      await window.googleDriveSyncAPI.pushNow()
      await refreshStatus()
      setStatusMessage('Respaldo subido correctamente')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo subir respaldo')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePullBackup = async () => {
    setIsProcessing(true)
    setStatusMessage('Descargando respaldo de Google Drive...')
    try {
      await window.googleDriveSyncAPI.pullNow()
      await refreshStatus()
      setStatusMessage('Respaldo aplicado sin reiniciar. Datos actualizados.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo descargar respaldo')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDiagnose = async () => {
    if (!status?.connected) {
      setStatusMessage('Conecta Google Drive para ejecutar diagnóstico')
      return
    }

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
      await refreshStatus()
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

  useEffect(() => {
    // No llamamos persistSyncSettings al montar para no sobreescribir enabled en disco
    refreshStatus()
      .then((nextStatus) => {
        // Auto-rellenar deviceName con el hostname del sistema si no hay uno guardado
        if (!syncForm.getValues('deviceName') && nextStatus?.systemHostname) {
          syncForm.setValue('deviceName', nextStatus.systemHostname)
        }
      })
      .catch(() => {
        setStatusMessage('No se pudo consultar el estado de sincronización')
      })
  }, [persistSyncSettings, storedSettings]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escuchar eventos de error del scheduler automático
  useEffect(() => {
    const unsub = window.googleDriveSyncAPI.onSyncStateChange((data: {
      syncing: boolean
      progress: number
      error?: string
      lastRunStatus?: string
      lastRunError?: string
    }) => {
      if (!data.syncing && data.error) {
        setStatusMessage(data.error)
      }
    })
    return () => unsub()
  }, [])

  const watchedValues = syncForm.watch()

  useEffect(() => {
    const parsed = SyncSettingsSchema.safeParse(watchedValues)
    if (!parsed.success) return

    const timer = window.setTimeout(() => {
      persistSyncSettings(parsed.data).catch(() => {
        // noop: evitar ruido en UI durante escritura de config local
      })
    }, 400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [persistSyncSettings, watchedValues])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sincronización <Badge variant="outline">MVP</Badge>
        </CardTitle>
        <CardDescription className="mb-1">
          Sincroniza configuración, base de datos y archivos de medios usando Google Drive.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center gap-2">
            {status?.connected ? (
              <CheckCircle2 className="size-4 text-primary" />
            ) : (
              <Link2 className="size-4" />
            )}
            <span className="text-sm font-medium">
              {status?.connected ? 'Conectado con Google Drive' : 'Sin conexión a Google Drive'}
            </span>
          </div>
          {status?.accountEmail ? (
            <p className="text-xs text-muted-foreground">Cuenta: {status.accountEmail}</p>
          ) : null}
          {status?.deviceName ? (
            <p className="text-xs text-muted-foreground">Dispositivo: {status.deviceName}</p>
          ) : null}
          {status?.lastSyncAt ? (
            <p className="text-xs text-muted-foreground">
              Última sincronización: {new Date(status.lastSyncAt).toLocaleString()}
            </p>
          ) : null}
          {status?.lastRunStatus === 'error' && status.lastRunError ? (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" />
              <span>{status.lastRunError}</span>
            </div>
          ) : null}
          {status?.pendingOutboxChanges !== undefined && status.pendingOutboxChanges > 0 ? (
            <p className="text-xs text-amber-600">
              {status.pendingOutboxChanges} cambios pendientes de subir
            </p>
          ) : null}
          {status?.pendingRestore ? (
            <p className="text-xs text-amber-600">
              Hay una restauración pendiente para aplicar al reiniciar.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="sync-enabled" className="text-sm font-medium">
              Activar sincronización
            </Label>
            <p className="text-xs text-muted-foreground">
              Habilita la conexión con un servidor de sincronización.
            </p>
          </div>
          <Switch
            id="sync-enabled"
            checked={isSyncEnabled}
            onCheckedChange={(checked) =>
              syncForm.setValue('enabled', checked, { shouldDirty: true })
            }
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sync-workspace-id">ID del workspace</Label>
          <Input
            id="sync-workspace-id"
            placeholder="iglesia-central"
            disabled={!isSyncEnabled}
            {...syncForm.register('workspaceId')}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sync-device-name">Nombre de este dispositivo</Label>
          <Input
            id="sync-device-name"
            placeholder={status?.systemHostname || 'Mi computadora'}
            disabled={!isSyncEnabled}
            {...syncForm.register('deviceName')}
          />
          <p className="text-xs text-muted-foreground">
            Debe ser único para cada equipo. Cambia este nombre en el segundo dispositivo antes de
            conectar.
          </p>
          {syncForm.formState.errors.deviceName ? (
            <p className="text-xs text-destructive">
              {syncForm.formState.errors.deviceName.message}
            </p>
          ) : null}
        </div>
      </CardContent>

      {/* Diagnóstico y reparación */}
      <CardContent className="space-y-3 border-t pt-4">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Diagnóstico y reparación</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isDiagnosing || isHealing || !status?.connected}
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
      </CardContent>

      <CardFooter className="justify-end gap-2 mt-2">
        <Button
          variant="outline"
          disabled={isProcessing || (!status?.connected && !isSyncEnabled)}
          onClick={status?.connected ? handleDisconnect : handleConnectGoogleDrive}
        >
          <Link2 className="size-4" /> {status?.connected ? 'Desconectar' : 'Conectar Google'}
        </Button>
        <Button
          variant="outline"
          disabled={isProcessing || !status?.connected}
          onClick={handlePullBackup}
        >
          <Download className="size-4" /> Descargar
        </Button>
        <Button
          variant="outline"
          disabled={isProcessing || !status?.connected || !isSyncEnabled}
          onClick={handlePushBackup}
        >
          <Upload className="size-4" /> Subir
        </Button>
        <Button
          disabled={isProcessing || !status?.connected || !isSyncEnabled}
          onClick={handleSyncNow}
        >
          <Upload className="size-4" /> Sincronizar ahora
        </Button>
      </CardFooter>

      {statusMessage ? (
        <div className="px-6 pb-4 text-xs text-muted-foreground">{statusMessage}</div>
      ) : null}

    </Card>
  )
}
