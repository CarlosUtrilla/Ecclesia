import LibraryPanel from './panels/library'
import SchedulePanel from './panels/schedule'
import LivePanels from './panels/items-on-live'
import LiveScreens from './panels/live-screens'
import { ScheduleProvider } from '@/contexts/ScheduleContext'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/ui/resizable'
import { ThemesSidePanel } from './panels/library/themesSidePanel'

type GroupLayout = Record<string, number>

const MAIN_LAYOUT_VERTICAL_KEY = 'main-layout-vertical-v2'
const MAIN_LAYOUT_HORIZONTAL_KEY = 'main-layout-horizontal-v2'
const LIBRARY_LAYOUT_HORIZONTAL_KEY = 'library-layout-horizontal-v2'

const DEFAULT_VERTICAL_LAYOUT: GroupLayout = {
  'main-top': 65,
  'main-library': 35
}

const DEFAULT_HORIZONTAL_LAYOUT: GroupLayout = {
  'main-schedule': 20,
  'main-live': 60,
  'main-screens': 20
}

const DEFAULT_LIBRARY_HORIZONTAL_LAYOUT: GroupLayout = {
  'library-themes': 15,
  'library-content': 85
}

function readLayout(key: string, fallback: GroupLayout): GroupLayout {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback
    }

    const entries = Object.entries(parsed as Record<string, unknown>)
    if (entries.length === 0) {
      return fallback
    }

    const normalized: GroupLayout = {}
    for (const [panelId, size] of entries) {
      if (typeof size !== 'number' || Number.isNaN(size)) {
        return fallback
      }
      normalized[panelId] = size
    }

    return {
      ...fallback,
      ...normalized
    }
  } catch {
    return fallback
  }
}

function persistLayout(key: string, layout: GroupLayout) {
  localStorage.setItem(key, JSON.stringify(layout))
}

export default function MainRoute() {
  const defaultVerticalLayout = readLayout(MAIN_LAYOUT_VERTICAL_KEY, DEFAULT_VERTICAL_LAYOUT)
  const defaultHorizontalLayout = readLayout(MAIN_LAYOUT_HORIZONTAL_KEY, DEFAULT_HORIZONTAL_LAYOUT)

  return (
    <ScheduleProvider>
      <ResizablePanelGroup
        id="main-group-vertical"
        direction="vertical"
        defaultLayout={defaultVerticalLayout}
        onLayoutChanged={(layout) => persistLayout(MAIN_LAYOUT_VERTICAL_KEY, layout)}
      >
        <ResizablePanel id="main-top" defaultSize={65} minSize={'50%'}>
          <ResizablePanelGroup
            id="main-group-horizontal"
            direction="horizontal"
            defaultLayout={defaultHorizontalLayout}
            onLayoutChanged={(layout) => persistLayout(MAIN_LAYOUT_HORIZONTAL_KEY, layout)}
          >
            <ResizablePanel id="main-schedule" defaultSize={20} minSize={'18%'} maxSize={'30%'}>
              <SchedulePanel />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="main-live" defaultSize={60} minSize={'30%'}>
              <LivePanels />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="main-screens" defaultSize={20} minSize={'18%'} maxSize={'30%'}>
              <LiveScreens />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle className="w-full" />
        <ResizablePanel id="main-library" defaultSize={35} minSize={'25%'}>
          <ResizablePanelGroup
            id="library-group-horizontal"
            direction="horizontal"
            defaultLayout={DEFAULT_LIBRARY_HORIZONTAL_LAYOUT}
            onLayoutChange={(layout) => persistLayout(LIBRARY_LAYOUT_HORIZONTAL_KEY, layout)}
          >
            <ResizablePanel id="library-themes" defaultSize={25} minSize={'10%'} maxSize={'25%'}>
              <ThemesSidePanel />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="library-content" defaultSize={75} minSize={'75%'} maxSize={'90%'}>
              <LibraryPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ScheduleProvider>
  )
}
