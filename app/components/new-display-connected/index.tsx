import { DisplayInfo } from 'electron/main/displayManager/displayType'
import { useEffect, useState } from 'react'
import { ScreenRol } from '@prisma/client'
import { Button } from '../../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Badge } from '../../ui/badge'
import { CircleSlash, Monitor, Tv } from 'lucide-react'

interface DisplayConfig {
  display: DisplayInfo
  selectedRole?: ScreenRol | 'NO_USE'
}

export default function NewDisplayConected() {
  const [displayConfigs, setDisplayConfigs] = useState<DisplayConfig[]>([])
  const [saving, setSaving] = useState(false)

  const fetchDisplays = async () => {
    try {
      const savedScreens = await window.api.selectedScreens.getAllSelectedScreens()
      const displays = await window.displayAPI.getDisplays()
      const newDisplays = displays.filter((d) => !savedScreens.find((ss) => ss.screenId === d.id))

      setDisplayConfigs(newDisplays.map((display) => ({ display, selectedRole: 'NO_USE' })))
    } catch (error) {
      console.error('Error fetching displays:', error)
    }
  }

  const handleRoleChange = (displayId: number, role: ScreenRol) => {
    setDisplayConfigs((prev) =>
      prev.map((config) =>
        config.display.id === displayId ? { ...config, selectedRole: role } : config
      )
    )
  }

  const handleSaveScreens = async () => {
    const configsToSave = displayConfigs.filter((config) => config.selectedRole)

    if (configsToSave.length === 0) {
      return
    }

    setSaving(true)
    try {
      const createPromises = configsToSave.map((config) =>
        window.api.selectedScreens.createSelectedScreen({
          screenId: config.display.id,
          screenName: config.display.label,
          rol: config.selectedRole === 'NO_USE' ? null : config.selectedRole
        })
      )

      await Promise.all(createPromises)

      // Refresh the list after saving
      await fetchDisplays()
      window.windowAPI.closeCurrentWindow()
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Configurar Pantallas Nuevas
          <Badge variant="secondary">{displayConfigs.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
              onValueChange={(value) => handleRoleChange(config.display.id, value as ScreenRol)}
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
      </CardContent>
    </Card>
  )
}
