import { useState } from 'react'
import { Button } from '@/ui/button'
import { CloudCog, ImagePlay, Info, Palette, Settings, X } from 'lucide-react'
import ColorSettingsSection from './components/colorSettingsSection'
import SyncSettingsSection from './components/syncSettingsSection'
import LogoFallbackSection from './components/logoFallbackSection'
import AboutSection from './components/aboutSection'

type SettingsSection = 'colors' | 'sync' | 'logoFallback' | 'about'

export default function SettingsScreen() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('colors')

  return (
    <div className="h-screen bg-background text-foreground flex">
      <aside className="w-64 border-r bg-muted/20 p-3 flex flex-col gap-2">
        <div className="px-2 py-1.5 text-sm font-semibold flex items-center gap-2">
          <Settings className="size-4" /> Ajustes
        </div>

        <Button
          variant={activeSection === 'colors' ? 'secondary' : 'ghost'}
          className="justify-start"
          onClick={() => setActiveSection('colors')}
        >
          <Palette className="size-4" /> Tema de colores
        </Button>

        <Button
          variant={activeSection === 'sync' ? 'secondary' : 'ghost'}
          className="justify-start"
          onClick={() => setActiveSection('sync')}
        >
          <CloudCog className="size-4" /> Sincronización
        </Button>

        <Button
          variant={activeSection === 'logoFallback' ? 'secondary' : 'ghost'}
          className="justify-start"
          onClick={() => setActiveSection('logoFallback')}
        >
          <ImagePlay className="size-4" /> Logo / Pantalla de fondo
        </Button>

        <Button
          variant={activeSection === 'about' ? 'secondary' : 'ghost'}
          className="justify-start"
          onClick={() => setActiveSection('about')}
        >
          <Info className="size-4" /> Acerca de
        </Button>

        <div className="mt-auto">
          <Button
            className="w-full"
            variant="outline"
            onClick={() => window.windowAPI.closeCurrentWindow()}
          >
            <X className="size-4" /> Cerrar
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          {activeSection === 'colors' ? <ColorSettingsSection /> : null}
          {activeSection === 'sync' ? <SyncSettingsSection /> : null}
          {activeSection === 'logoFallback' ? <LogoFallbackSection /> : null}
          {activeSection === 'about' ? <AboutSection /> : null}
        </div>
      </main>
    </div>
  )
}
