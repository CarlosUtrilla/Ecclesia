import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'
import { Badge } from '@/ui/badge'
import { Separator } from '@/ui/separator'
import { useApiConfiguration } from '@ecclesia/queries'
import { useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Search, Monitor, Wifi, WifiOff, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { switchSSEConnection } from '@/lib/sseEvents'

type LanResults = {
  ip: string
  name: string
}

function saveLocalSetting(key: string, value: string): void {
  localStorage.setItem(`ecclesia:${key}`, value)
}

function loadLocalSetting(key: string): string | null {
  return localStorage.getItem(`ecclesia:${key}`)
}

export default function RemoteControl() {
  const queryClient = useQueryClient()
  const { setApiConfiguration } = useApiConfiguration()
  const [usingRemoteMode, setUsingRemoteMode] = useState(() => loadLocalSetting('remoteControlEnabled') === 'true')
  const [remoteControlIp, setRemoteControlIp] = useState(() => loadLocalSetting('remoteControlIP') ?? '')
  const [connectedIp, setConnectedIp] = useState<string | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [devices, setDevices] = useState<LanResults[]>([])

  useEffect(() => {
    const savedIp = loadLocalSetting('remoteControlIP')
    if (savedIp && usingRemoteMode) {
      setConnectedIp(savedIp)
      setRemoteControlIp(savedIp)
    }
  }, [])

  const handleToggleRemoteMode = (enabled: boolean) => {
    setUsingRemoteMode(enabled)
    saveLocalSetting('remoteControlEnabled', String(enabled))
    if (!enabled && connectedIp) {
      handleDisconnect()
    }
  }

  const handleSearchOnLan = async () => {
    setDiscovering(true)
    setDevices([])
    try {
      const results = await window.remoteControlAPI.discoverLan()
      setDevices(
        results.filter((d) => d.ip !== remoteControlIp)
      )
      if (results.length === 0) {
        toast.info('No se encontraron dispositivos en la red')
      } else {
        toast.success(`Se encontraron ${results.length} dispositivo(s)`)
      }
    } catch (error) {
      toast.error('Error al buscar dispositivos', {
        description: error instanceof Error ? error.message : 'Error desconocido'
      })
    } finally {
      setDiscovering(false)
    }
  }

  const handleConnect = async (ip?: string) => {
    const targetIp = ip || remoteControlIp
    if (!targetIp) {
      toast.warning('Introduce una IP o selecciona un dispositivo')
      return
    }
    setConnecting(true)
    try {
      await setApiConfiguration(queryClient, `http://${targetIp}`, 7777)
      switchSSEConnection(`http://${targetIp}`)
      setConnectedIp(targetIp)
      setRemoteControlIp(targetIp)
      saveLocalSetting('remoteControlIP', targetIp)
      toast.success(`Conectado a ${targetIp}`)
    } catch (error) {
      toast.error('No se pudo conectar', {
        description: error instanceof Error ? error.message : 'Verifica que la IP sea correcta y que Eclessia esté ejecutándose'
      })
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setConnecting(true)
    try {
      await setApiConfiguration(queryClient, 'http://localhost', 7777)
      switchSSEConnection(null)
      setConnectedIp(null)
      toast.success('Desconectado del dispositivo remoto')
    } catch {
      toast.error('Error al restaurar conexión local')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modo control remoto</CardTitle>
        <CardDescription>Controla otra instancia de Eclessia por LAN</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 py-2">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="sync-enabled" className="text-sm font-medium">
              Conectarse a otra instancia LAN
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              <b className="italic">ON:</b> Controlas otra instancia de Eclessia en la red LAN
            </p>
            <p className="text-xs text-muted-foreground">
              <b className="italic">OFF:</b> Controlas la instancia de tu dispositivo actual
            </p>
          </div>
          <Switch
            id="sync-enabled"
            checked={usingRemoteMode}
            onCheckedChange={handleToggleRemoteMode}
          />
        </div>

        {withConnectedBadge(connectedIp)}

        {usingRemoteMode && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="size-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Dispositivos encontrados en LAN</Label>
              </div>

              <Button
                onClick={handleSearchOnLan}
                variant="outline"
                className="w-full mb-3 gap-2"
                disabled={discovering}
              >
                {discovering ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {discovering ? 'Buscando...' : 'Buscar en LAN'}
              </Button>

              {devices.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {devices.map((device) => (
                    <div
                      key={device.ip}
                      className={`flex items-center justify-between rounded-lg border p-2.5 transition-colors ${
                        connectedIp === device.ip
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Monitor className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{device.name}</p>
                          <p className="text-xs text-muted-foreground">{device.ip}</p>
                        </div>
                      </div>
                      {connectedIp === device.ip ? (
                        <Badge variant="default" className="shrink-0 gap-1">
                          <Wifi className="size-3" />
                          Conectado
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1"
                          onClick={() => handleConnect(device.ip)}
                          disabled={connecting}
                        >
                          {connecting ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <ArrowRight className="size-3" />
                          )}
                          Conectar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : !discovering ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {connectedIp
                    ? 'Conectado a un dispositivo. Busca de nuevo para ver otros.'
                    : 'Presiona "Buscar en LAN" para descubrir dispositivos.'}
                </p>
              ) : null}
            </div>

            <Separator />

            <div className="rounded-lg border p-3">
              <Label htmlFor="ip" className="text-sm font-medium">
                IP del dispositivo LAN:
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="ip"
                  placeholder="Ej: 192.168.100.1"
                  value={remoteControlIp}
                  onChange={(e) => setRemoteControlIp(e.target.value)}
                />
                {connectedIp ? (
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={connecting}
                    className="shrink-0"
                  >
                    {connecting ? (
                      <Loader2 className="size-4 mr-1 animate-spin" />
                    ) : (
                      <WifiOff className="size-4 mr-1" />
                    )}
                    {connecting ? 'Desconectando...' : 'Desconectar'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleConnect()}
                    disabled={!remoteControlIp || connecting}
                    className="shrink-0"
                  >
                    {connecting ? (
                      <Loader2 className="size-4 mr-1 animate-spin" />
                    ) : (
                      <Wifi className="size-4 mr-1" />
                    )}
                    {connecting ? 'Conectando...' : 'Conectar'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function withConnectedBadge(connectedIp: string | null) {
  if (!connectedIp) return null
  return (
    <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-2.5">
      <Wifi className="size-4 text-green-500" />
      <div className="text-xs">
        <span className="font-medium text-green-600 dark:text-green-400">Conectado a </span>
        <code className="text-green-600 dark:text-green-400">{connectedIp}</code>
      </div>
      <Badge variant="outline" className="ml-auto text-green-600 border-green-500/30 text-xs">
        En vivo
      </Badge>
    </div>
  )
}
