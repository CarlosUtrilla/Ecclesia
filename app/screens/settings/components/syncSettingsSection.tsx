import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Save } from 'lucide-react'
import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/card'
import { Badge } from '@/ui/badge'
import { Label } from '@/ui/label'
import { Input } from '@/ui/input'
import { Switch } from '@/ui/switch'
import { SyncSettingsForm, SyncSettingsSchema } from '../schema'

const SYNC_SETTINGS_KEY = 'ecclesia-sync-settings'

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
    serverUrl: '',
    workspaceId: '',
    deviceName: 'Este dispositivo'
  }
}

export default function SyncSettingsSection() {
  const syncForm = useForm<SyncSettingsForm>({
    resolver: zodResolver(SyncSettingsSchema),
    mode: 'onChange',
    defaultValues: getStoredSyncSettings()
  })

  const isSyncEnabled = syncForm.watch('enabled')

  const handleSaveSyncSettings = syncForm.handleSubmit((values) => {
    localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(values))
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sincronización <Badge variant="outline">MVP</Badge>
        </CardTitle>
        <CardDescription>
          Configura la base para sincronizar configuración, base de datos y archivos entre equipos.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
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
          <Label htmlFor="sync-server-url">URL del servidor</Label>
          <Input
            id="sync-server-url"
            placeholder="https://tu-servidor-sync.com"
            disabled={!isSyncEnabled}
            {...syncForm.register('serverUrl')}
          />
          {syncForm.formState.errors.serverUrl ? (
            <span className="text-xs text-destructive">
              {syncForm.formState.errors.serverUrl.message}
            </span>
          ) : null}
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
          <Label htmlFor="sync-device-name">Nombre del dispositivo</Label>
          <Input
            id="sync-device-name"
            placeholder="Cabina principal"
            {...syncForm.register('deviceName')}
          />
          {syncForm.formState.errors.deviceName ? (
            <span className="text-xs text-destructive">
              {syncForm.formState.errors.deviceName.message}
            </span>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="justify-end gap-2">
        <Button variant="outline" onClick={() => syncForm.reset(getStoredSyncSettings())}>
          Restablecer
        </Button>
        <Button onClick={handleSaveSyncSettings}>
          <Save className="size-4" /> Guardar ajustes
        </Button>
      </CardFooter>
    </Card>
  )
}
