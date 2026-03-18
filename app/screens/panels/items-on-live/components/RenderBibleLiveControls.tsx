import { useSchedule } from '@/contexts/ScheduleContext'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import RenderBibleVerses from './RenderBibleVerses'
import BibleVersionSelector from './BibleVersionSelector'

type Props = {
  data: PresentationViewItems[]
}

function parseBibleVersion(accessData: string): string {
  return accessData.split(',')[3] || 'RVR1960'
}

function parseBiblePreviewSource(accessData: string) {
  const [bookRaw, chapterRaw, verseRangeRaw] = accessData.split(',')
  const [verseStartRaw, verseEndRaw] = (verseRangeRaw || '').split('-')

  const bookId = Number(bookRaw)
  const chapter = Number(chapterRaw)
  const verseStart = Number(verseStartRaw)
  const verseEnd = verseEndRaw ? Number(verseEndRaw) : verseStart

  if (!Number.isFinite(bookId) || !Number.isFinite(chapter) || !Number.isFinite(verseStart)) {
    return null
  }

  return {
    bookId,
    chapter,
    verseStart,
    verseEnd: Number.isFinite(verseEnd) ? verseEnd : verseStart
  }
}

export default function RenderBibleLiveControls({ data }: Props) {
  const { itemOnLive, setItemOnLive } = useSchedule()

  const currentVersion = itemOnLive ? parseBibleVersion(itemOnLive.accessData) : ''
  const previewSource = itemOnLive ? parseBiblePreviewSource(itemOnLive.accessData) : null

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
      <div className="shrink-0 border-t bg-background/80 px-3 py-2">
        <BibleVersionSelector
          value={currentVersion}
          onValueChange={handleVersionChange}
          previewSource={previewSource}
          className="w-full"
        />
      </div>
    </div>
  )
}
