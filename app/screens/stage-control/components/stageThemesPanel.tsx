import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Monitor } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Button } from '@/ui/button'
import { useThemes } from '@/hooks/useThemes'

type StageScreenRecord = {
  id: number
  screenId: number
  screenName: string
  rol: 'LIVE_SCREEN' | 'STAGE_SCREEN' | null
}

type StageScreenConfigRecord = {
  selectedScreenId: number
  themeId: number | null
}

export default function StageThemesPanel() {
  const queryClient = useQueryClient()
  const { themes } = useThemes()

  const { data: stageScreens = [] } = useQuery<StageScreenRecord[]>({
    queryKey: ['selectedScreens', 'stage'],
    queryFn: () => window.api.selectedScreens.getSelectedScreensByRole('STAGE_SCREEN')
  })

  const { data: stageConfigs = [] } = useQuery<StageScreenConfigRecord[]>({
    queryKey: ['stageScreenConfig'],
    queryFn: () => window.api.stageScreenConfig.getAllStageScreenConfigs(),
    staleTime: Infinity
  })

  const configByScreenId = useMemo(() => {
    return new Map(stageConfigs.map((config) => [config.selectedScreenId, config]))
  }, [stageConfigs])

  const { mutate: saveThemeByScreen, isPending } = useMutation({
    mutationFn: (payload: { selectedScreenId: number; themeId: number | null }) =>
      window.api.stageScreenConfig.upsertStageScreenConfig(payload),
    onSuccess: async (updatedConfig) => {
      await queryClient.invalidateQueries({ queryKey: ['stageScreenConfig'] })
      await window.displayAPI.updateStageScreenConfig({
        selectedScreenId: updatedConfig.selectedScreenId
      })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tema de Stage</CardTitle>
        <CardDescription>
          Asigna el tema visual por pantalla stage y abre el editor de recursos/layout.
        </CardDescription>
        <div className="pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.windowAPI.openStageLayoutWindow()}
          >
            Abrir Editor Stage
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {stageScreens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pantallas stage configuradas.</p>
        ) : (
          stageScreens.map((screen) => {
            const selectedThemeId = configByScreenId.get(screen.id)?.themeId ?? null

            return (
              <div
                key={screen.id}
                className="rounded-lg border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Monitor className="size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{screen.screenName}</p>
                    <p className="text-xs text-muted-foreground">Display ID: {screen.screenId}</p>
                  </div>
                </div>

                <Select
                  value={selectedThemeId !== null ? String(selectedThemeId) : 'none'}
                  onValueChange={(value) => {
                    saveThemeByScreen({
                      selectedScreenId: screen.id,
                      themeId: value === 'none' ? null : Number(value)
                    })
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Seleccionar tema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin tema stage</SelectItem>
                    {themes.map((theme) => (
                      <SelectItem key={theme.id} value={String(theme.id)}>
                        {theme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
