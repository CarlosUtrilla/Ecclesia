import { DisplayInfo } from 'electron/main/displayManager/displayType'
import { useEffect, useState } from 'react'
import { ScreenRol } from '@prisma/client'
import { Button } from '../../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Badge } from '../../ui/badge'
import { CircleSlash, Monitor, Tv } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/dialog'

interface DisplayConfig {
  display: DisplayInfo
  selectedRole?: ScreenRol | 'NO_USE'
  configured?: boolean
  id?: number // id del registro en DB
}

export default function NewDisplayConected({
  open,
  onOpenChange,
  onSaved
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const [displayConfigs, setDisplayConfigs] = useState<DisplayConfig[]>([])
  const [saving, setSaving] = useState(false)

  const fetchDisplays = async () => {
    try {
      const savedScreens = await window.api.selectedScreens.getAllSelectedScreens()
      const displays = await window.displayAPI.getDisplays()
      // Para cada pantalla detectada, buscar si ya está configurada y mostrar su rol
      const configs = displays.map((display) => {
        const found = savedScreens.find((ss) => ss.screenId === display.id)
        return {
          display,
          selectedRole: (found?.rol as ScreenRol) ?? 'NO_USE',
          configured: !!found,
          id: found?.id
        }
      })
      setDisplayConfigs(configs)
    } catch (error) {
      console.error('Error fetching displays:', error)
    }
  }

  const handleRoleChange = (displayId: number, role: ScreenRol | 'NO_USE') => {
    setDisplayConfigs((prev) =>
      prev.map((config) =>
        config.display.id === displayId ? { ...config, selectedRole: role } : config
      )
    )
  }

  const handleSaveScreens = async () => {
    const configsToSave = displayConfigs.filter((config) => config.selectedRole !== undefined)

    setSaving(true)
    try {
      const savePromises = configsToSave.map((config) => {
        const normalizedRole = config.selectedRole === 'NO_USE' ? null : config.selectedRole

        const screenData = {
          screenId: config.display.id,
          screenName: config.display.label,
          rol: normalizedRole
        }

        if (config.selectedRole === 'NO_USE') {
          if (config.configured && config.id) {
            return window.api.selectedScreens.updateSelectedScreen({
              id: config.id,
              ...screenData
            })
          }
          return window.api.selectedScreens.createSelectedScreen(screenData)
        }

        if (config.configured && config.id) {
          return window.api.selectedScreens.updateSelectedScreen({
            id: config.id,
            ...screenData
          })
        }

        return window.api.selectedScreens.createSelectedScreen(screenData)
      })

      await Promise.all(savePromises)

      // Refrescar la lista después de guardar
      await fetchDisplays()
      onSaved?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving screens:', error)
    } finally {
      setSaving(false)
    }
  }

  const getRoleIcon = (role?: ScreenRol | 'NO_USE') => {
    switch (role) {
      case 'LIVE_SCREEN':
        return <Tv className="w-4 h-4" />
      case 'STAGE_SCREEN':
        return <Monitor className="w-4 h-4" />
      default:
        return <CircleSlash className="w-4 h-4" />
    }
  }

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('display-update', () => {
      fetchDisplays()
    })
    fetchDisplays()
    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Configurar Pantallas
            <Badge variant="secondary">{displayConfigs.length}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {displayConfigs.map((config) => (
            <div
              key={config.display.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getRoleIcon(config.selectedRole)}
                <div>
                  <h4 className="font-medium">{config.display.label}</h4>
                  <p className="text-sm text-muted-foreground">
                    {config.display.bounds.width}x{config.display.bounds.height}
                    {config.display.internal ? ' • Interna' : ' • Externa'}
                  </p>
                </div>
              </div>

              <Select
                value={config.selectedRole || ''}
                onValueChange={(value) =>
                  handleRoleChange(config.display.id, value as ScreenRol | 'NO_USE')
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccionar uso..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIVE_SCREEN">
                    <div className="flex items-center gap-2">
                      <Tv className="w-4 h-4" />
                      Pantalla en Vivo
                    </div>
                  </SelectItem>
                  <SelectItem value="STAGE_SCREEN">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      Pantalla de Escenario
                    </div>
                  </SelectItem>
                  <SelectItem value="NO_USE">
                    <div className="flex items-center gap-2">
                      <CircleSlash className="w-4 h-4" />
                      Sin uso
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveScreens}
              disabled={saving || displayConfigs.every((config) => !config.selectedRole)}
            >
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
