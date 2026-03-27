import { useSchedule } from '@/contexts/ScheduleContext'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import RenderBibleVerses from './RenderBibleVerses'
import BibleVersionSelector from './BibleVersionSelector'
import {
  buildBibleAccessData,
  parseBibleAccessData,
  parseBibleVerseRange
} from '@/screens/panels/library/bible/accessData'

type Props = {
  data: PresentationViewItems[]
}

function parseBibleVersion(accessData: string): string {
  return parseBibleAccessData(accessData)?.version || 'RVR1960'
}

function parseBiblePreviewSource(accessData: string) {
  const parsed = parseBibleAccessData(accessData)
  if (!parsed) {
    return null
  }

  const verses = parseBibleVerseRange(parsed.verseRange)
  if (verses.length === 0) {
    return null
  }

  const verseStart = verses[0]
  const verseEnd = verses[verses.length - 1]

  return {
    bookId: parsed.bookId,
    chapter: parsed.chapter,
    verseStart,
    verseEnd,
    verses
  }
}

export default function RenderBibleLiveControls({ data }: Props) {
  const { itemOnLive, setItemOnLive } = useSchedule()

  const currentVersion = itemOnLive ? parseBibleVersion(itemOnLive.accessData) : ''
  const previewSource = itemOnLive ? parseBiblePreviewSource(itemOnLive.accessData) : null

  const handleVersionChange = (newVersion: number | string) => {
    if (!itemOnLive || !newVersion || String(newVersion) === currentVersion) return

    const parsed = parseBibleAccessData(itemOnLive.accessData)
    if (!parsed) return

    setItemOnLive({
      ...itemOnLive,
      accessData: buildBibleAccessData({
        ...parsed,
        version: String(newVersion)
      })
    })
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
