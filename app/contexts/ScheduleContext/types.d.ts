import { Media, ScheduleItem, ScheduleItemType } from '@prisma/client'
import { ThemeWithMedia } from 'database/controllers/themes/themes.dto'
import { ScheduleSchemaType } from './schema'
import { SongResponseDTO } from 'database/controllers/songs/songs.dto'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { DisplayWithUsage } from '@/hooks/useDisplays'
import { UseFormReturn } from 'react-hook-form'

export type ILiveContext = {
  itemIndex: number
  setItemIndex: (index: number) => void
  liveContentVersion: number
  presentationVerseBySlideKey: Record<string, number>
  setPresentationVerseBySlideKey: (
    updater:
      | Record<string, number>
      | ((previous: Record<string, number>) => Record<string, number>)
  ) => void
  itemOnLive: ScheduleItem | null
  liveScreens: DisplayWithUsage[]
  showLiveScreen: boolean
  setShowLiveScreen: (show: boolean) => void
  contentScreen?: ContentScreen | null
  showItemOnLiveScreen: (item: ScheduleItem, index?: number) => Promise<void>
  sendLiveMediaState: (state: LiveMediaState) => void
  liveScreensReady: boolean
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
  getScheduleItemContentScreen: (item: ScheduleItem) => Promise<ContentScreen>
  songs: SongResponseDTO[]
  media: Media[]
  addItemToSchedule: (item: AddItemToSchedule) => void
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
}
