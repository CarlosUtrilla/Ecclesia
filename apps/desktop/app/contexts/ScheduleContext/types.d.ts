import { Media, ScheduleItem, ScheduleItemType } from '@ecclesia/api'
import { ThemeWithMedia } from '@ecclesia/api/src/controllers/themes/themes.dto'
import { ScheduleSchemaType } from './schema'
import { SongResponseDTO } from '@ecclesia/api/src/controllers/songs/songs.dto'
import { PresentationResponseDTO } from '@ecclesia/api/src/controllers/presentations/presentations.dto'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { DisplayWithUsage } from '@/hooks/useDisplays'
import { UseFormReturn } from 'react-hook-form'
import { PresentationBibleOverrideMap } from '@/lib/presentationBibleVersionOverrides'

export type ILiveContext = {
  itemIndex: number
  setItemIndex: (index: number) => void
  liveContentVersion: number
  appliedTheme: ThemeWithMedia
  presentationVerseBySlideKey: Record<string, number>
  setPresentationVerseBySlideKey: (
    updater:
      | Record<string, number>
      | ((previous: Record<string, number>) => Record<string, number>)
  ) => void
  presentationBibleOverrideByKey: PresentationBibleOverrideMap
  setPresentationBibleOverrideByKey: (
    updater:
      | PresentationBibleOverrideMap
      | ((previous: PresentationBibleOverrideMap) => PresentationBibleOverrideMap)
  ) => void
  itemOnLive: ScheduleItem | null
  liveScreens: DisplayWithUsage[]
  stageScreens: DisplayWithUsage[]
  showLiveScreen: boolean
  setShowLiveScreen: (show: boolean) => void
  contentScreen?: ContentScreen | null
  showItemOnLiveScreen: (item: ScheduleItem, index?: number) => Promise<void>
  sendLiveMediaState: (state: LiveMediaState) => void
  liveScreensReady: boolean
  hideTextOnLive: boolean
  showLogoOnLive: boolean
  blackScreenOnLive: boolean
  setHideTextOnLive: (value: boolean) => void
  setShowLogoOnLive: (value: boolean) => void
  setBlackScreenOnLive: (value: boolean) => void
}

export type AddItemToSchedule = { type: ScheduleItemType; accessData: any; insertPosition?: number }

type IScheduleContext = {
  itemOnLive: ScheduleItem | null
  setItemOnLive: (item: ScheduleItem | null) => void
  selectedTheme: ThemeWithMedia
  setSelectedTheme: (theme: ThemeWithMedia) => void
  currentSchedule: ScheduleItemData[]
  form: UseFormReturn<ScheduleSchemaType>
  getScheduleItemIcon: (item: ScheduleItem) => React.ReactNode
  getScheduleItemLabel: (item: ScheduleItem) => Promise<string | JSX.Element>
  getScheduleItemContentScreen: (
    item: ScheduleItem,
    options?: { presentationBibleOverrideByKey?: PresentationBibleOverrideMap }
  ) => Promise<ContentScreen>
  songs: SongResponseDTO[]
  media: Media[]
  presentations: PresentationResponseDTO[]
  addItemToSchedule: (item: AddItemToSchedule) => void
  updateItemAccessData: (itemId: string, accessData: string) => void
  deleteItemFromSchedule: (index: number) => void
  reorderItems: (activeId: string, overId: string) => void
  reorderInMainSchedule: (activeId: string, overId: string) => void
  saveScheduleChanges: () => Promise<void>
  itemsSortableIndex: string[]
  loadSchedule: (scheduleId: number) => Promise<void>
  createTemporarySchedule: () => void
  isTemporary: boolean
  formData: ScheduleSchemaType
  cleanForm: () => void
}

export type ContentScreen = {
  title: string
  content: PresentationViewItems[]
  /**
   * `presentation` cuando el contenido son diapositivas aunque el item no sea de tipo
   * PRESENTATION (medios PDF/PPTX, que redirigen a su presentación vinculada). Permite
   * elegir el render sin depender de tener el Media en cache.
   */
  renderAs?: 'presentation'
}
