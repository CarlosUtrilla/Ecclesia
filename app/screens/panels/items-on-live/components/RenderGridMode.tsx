import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { PresentationView } from '@/ui/PresentationView'
import { PresentationViewItems } from '@/ui/PresentationView/types'

type Props = {
  data: PresentationViewItems[]
}

export default function RenderGridMode({ data }: Props) {
  const { selectedTheme } = useSchedule()
  const { itemIndex, setItemIndex } = useLive()
  return (
    <div className="flex gap-3 items-center flex-wrap p-4">
      {data.map((item, i) => (
        <PresentationView
          selected={i === itemIndex}
          onClick={() => setItemIndex(i)}
          className="max-w-64"
          key={i}
          items={[item]}
          theme={selectedTheme}
        />
      ))}
    </div>
  )
}
