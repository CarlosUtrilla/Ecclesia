import StageControlsPanel from './components/stageControlsPanel'
import StageThemesPanel from './components/stageThemesPanel'
import { Button } from '@/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'

export default function StageControlScreen() {
  return (
    <div className="h-full w-full bg-background p-6">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h1 className="text-xl font-semibold">Control de Escenario</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tema, recursos y estado operativo de pantallas stage.
            </p>
          </div>
          <Button variant="outline" onClick={() => window.windowAPI.closeCurrentWindow()}>
            Cerrar
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <Tabs defaultValue="control" className="h-full gap-3">
            <TabsList>
              <TabsTrigger value="control">Control Stage</TabsTrigger>
              <TabsTrigger value="themes">Temas Stage</TabsTrigger>
            </TabsList>

            <TabsContent value="control" className="min-h-0 overflow-auto pr-1">
              <StageControlsPanel />
            </TabsContent>

            <TabsContent value="themes" className="min-h-0 overflow-auto pr-1">
              <StageThemesPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
