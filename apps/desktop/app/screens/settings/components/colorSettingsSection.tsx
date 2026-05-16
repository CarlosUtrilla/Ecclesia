import { useMemo, useState } from 'react'
import { Badge } from '@/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { cn } from '@/lib/utils'
import { Monitor, Moon, Sun } from 'lucide-react'

const COLOR_THEME_KEY = 'ecclesia-color-theme'

type ThemeMode = 'light' | 'dark' | 'system'

const getStoredThemeMode = (): ThemeMode => {
  const savedMode = localStorage.getItem(COLOR_THEME_KEY)
  if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
    return savedMode
  }
  return 'system'
}

const applyThemeMode = (mode: ThemeMode) => {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldUseDark = mode === 'dark' || (mode === 'system' && prefersDark)

  root.classList.toggle('dark', shouldUseDark)
}

export default function ColorSettingsSection() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode())

  const colorModeOptions = useMemo(
    () => [
      {
        value: 'light' as const,
        title: 'Claro',
        description: 'Interfaz con fondo claro.',
        icon: Sun
      },
      {
        value: 'dark' as const,
        title: 'Oscuro',
        description: 'Interfaz con fondo oscuro.',
        icon: Moon
      },
      {
        value: 'system' as const,
        title: 'Sistema',
        description: 'Usa la apariencia del sistema.',
        icon: Monitor
      }
    ],
    []
  )

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode)
    localStorage.setItem(COLOR_THEME_KEY, mode)
    applyThemeMode(mode)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tema de colores</CardTitle>
        <CardDescription>
          Define el modo visual global de Ecclesia para esta instalación.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3">
        {colorModeOptions.map((option) => {
          const Icon = option.icon
          const isActive = themeMode === option.value

          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                'w-full text-left border rounded-lg px-3 py-3 transition-colors bg-card',
                isActive
                  ? 'border-primary ring-1 ring-primary/20'
                  : 'border-border hover:bg-muted/40'
              )}
              onClick={() => handleThemeModeChange(option.value)}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4" />
                <span className="font-medium">{option.title}</span>
                {isActive ? <Badge className="ml-auto">Activo</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
