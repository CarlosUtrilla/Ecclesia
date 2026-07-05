import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Api } from '@ecclesia/queries'
import { Switch } from '@/ui/switch'

type SettingValue = { key: string; value: string }

export default function CopyrightSettingsSection() {
  const queryClient = useQueryClient()

  const { data: settings } = useQuery({
    ...Api.query.settings.getSettings({
      body: { settings: ['SHOW_COPYRIGHT_ON_LIVE'] }
    }),
    select: (data: SettingValue[]) => data[0]
  } as any)

  const saveSettings = useMutation({
    mutationFn: (value: string) =>
      Api.fetch.settings.updateSettings({
        body: { settings: [{ key: 'SHOW_COPYRIGHT_ON_LIVE', value }] }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
  } as any)

  const isEnabled = settings?.value === 'true'

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <label htmlFor="show-copyright-toggle" className="font-medium text-sm">
          Mostrar créditos en vivo
        </label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Muestra el aviso de derechos de autor en la parte inferior de las presentaciones de canciones
        </p>
      </div>
      <Switch
        id="show-copyright-toggle"
        checked={isEnabled}
        onCheckedChange={(checked) => {
          saveSettings.mutate(checked ? 'true' : 'false')
        }}
      />
    </div>
  )
}
