import { useCallback, useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { AlertCircle, CheckCircle2, Download, Link2, Upload } from 'lucide-react'
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

      <CardFooter className="justify-end gap-2 mt-6">
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
