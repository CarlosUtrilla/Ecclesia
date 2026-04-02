import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Monitor } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Button } from '@/ui/button'
import { useThemes } from '@/hooks/useThemes'
import { buildGlobalStageUpsertPayloads, getGlobalStageConfig } from '@/screens/stage/shared/globalStageConfig'

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

type Props = {
  onOpenLayoutTab?: () => void
}

export default function StageThemesPanel({ onOpenLayoutTab }: Props) {
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

  const globalConfig = useMemo(() => {
    return getGlobalStageConfig(stageScreens, stageConfigs)
  }, [stageConfigs, stageScreens])

  const { mutate: saveGlobalTheme, isPending } = useMutation({
    mutationFn: async (payload: { themeId: number | null }) => {
      const updates = buildGlobalStageUpsertPayloads(stageScreens, payload)
      await Promise.all(
        updates.map((update) => window.api.stageScreenConfig.upsertStageScreenConfig(update))
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stageScreenConfig'] })
      await Promise.all(
        stageScreens.map((screen) =>
          window.displayAPI.updateStageScreenConfig({
            selectedScreenId: screen.id
          })
        )
      )
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tema de Stage</CardTitle>
        <CardDescription>
          Usa un tema global compartido por todas las pantallas stage.
        </CardDescription>
        <div className="pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onOpenLayoutTab?.()
            }}
          >
            Abrir Editor Stage
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {stageScreens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pantallas stage configuradas.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Monitor className="size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">Tema global de stage</p>
                  <p className="text-xs text-muted-foreground">
                    Se aplica a {stageScreens.length} pantalla(s) stage.
                  </p>
                </div>
              </div>

              <Select
                value={
                  globalConfig?.config?.themeId !== null && globalConfig?.config?.themeId !== undefined
                    ? String(globalConfig.config.themeId)
                    : 'none'
                }
                onValueChange={(value) => {
                  saveGlobalTheme({
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

            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Pantallas incluidas: {stageScreens.map((screen) => screen.screenName).join(', ')}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
