import { useMemo } from 'react'
import ThemesPanel from './themes'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useQuery } from '@tanstack/react-query'

export default function LiveItem() {
  const { itemOnLive, getScheduleItemContentScreen } = useSchedule()
  const { data: content = [] } = useQuery({
    queryKey: ['liveItemContent', itemOnLive?.id],
    queryFn: () => {
      if (!itemOnLive) return []
      return getScheduleItemContentScreen(itemOnLive)
    },
    enabled: !!itemOnLive
  })

  return (
    <div className="h-full border-r">
      <div className="h-7/12">
        {content ? (
          <div>
            {content.map(({ text }) => (
              <div key={text}>{text}</div>
            ))}
          </div>
        ) : null}
      </div>
      <ThemesPanel />
    </div>
  )
}
