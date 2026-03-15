import { AutoComplete, Option } from '@/ui/autocomplete'
import { useSchedule } from '@/contexts/ScheduleContext'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import useBibleVersions from '@/hooks/useBibleVersions'
import { BookOpen } from 'lucide-react'
import RenderBibleVerses from './RenderBibleVerses'

type Props = {
  data: PresentationViewItems[]
}

function parseBibleVersion(accessData: string): string {
  return accessData.split(',')[3] || 'RVR1960'
}

export default function RenderBibleLiveControls({ data }: Props) {
  const { itemOnLive, setItemOnLive } = useSchedule()
  const { data: versions, isLoading } = useBibleVersions()

  const currentVersion = itemOnLive ? parseBibleVersion(itemOnLive.accessData) : ''

  const options: Option[] = (versions || []).map((v) => ({
    value: v.version,
    label: v.name ? `${v.version} — ${v.name}` : v.version
  }))

  const handleVersionChange = (newVersion: number | string) => {
    if (!itemOnLive || !newVersion || String(newVersion) === currentVersion) return
    const parts = itemOnLive.accessData.split(',')
    parts[3] = String(newVersion)
    setItemOnLive({ ...itemOnLive, accessData: parts.join(',') })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-hidden">
        <RenderBibleVerses data={data} />
      </div>
      <div className="shrink-0 border-t bg-background/80 px-3 py-2 flex items-center gap-2">
        <BookOpen className="size-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground shrink-0">Versión</span>
        <AutoComplete
          options={options}
          value={currentVersion}
          onValueChange={handleVersionChange}
          emptyMessage="Versión no encontrada"
          placeholder="Buscar versión..."
          isLoading={isLoading}
          className="w-52"
          contentPlacement="top"
        />
      </div>
    </div>
  )
}
