import { Media, ScheduleGroup, ScheduleItem, ScheduleItemType } from '@prisma/client'
import { ThemeWithMedia } from 'database/controllers/themes/themes.dto'
import { ScheduleSchemaType } from './schema'
import { SongResponseDTO } from 'database/controllers/songs/songs.dto'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { DisplayWithUsage } from '@/hooks/useDisplays'

export type ILiveContext = {
  itemIndex: number
  setItemIndex: (index: number) => void
  itemOnLive: ScheduleItem | null
  liveScreens: DisplayWithUsage[]
  showLiveScreen: boolean
  setShowLiveScreen: (show: boolean) => void
  contentScreen?: ContentScreen | null
  showItemOnLiveScreen: (item: ScheduleItem, index?: number) => Promise<void>
}

export type AddItemToSchedule = { type: ScheduleItemType; accessData: any }

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
}

export type ContentScreen = {
  title: string
  content: PresentationViewItems[]
}

export type ScheduleItemData = {
  group: ScheduleGroup | null
  items: ScheduleItem[]
  order: number
}
