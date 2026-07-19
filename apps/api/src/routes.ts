import SettingsController from './controllers/settings/settings.controller'
import SongsController from './controllers/songs/songs.controller'
import { ThemesController } from './controllers/themes/themes.controller'
import { MediaController } from './controllers/media/media.controller'
import { TagSongsController } from './controllers/tagSongs/tagSongs.controller'
import BibleController from './controllers/bible/bible.controller'
import { ScheduleController } from './controllers/schedule/schedule.controller'
import SelectedScreensController from './controllers/selectedScreens/selectedScreens.controller'
import FontsController from './controllers/fonts/fonts.controller'
import { PresentationsController } from './controllers/presentations/presentations.controller'
import StageScreenConfigController from './controllers/stageScreenConfig/stageScreenConfig.controller'
import { OplogController } from './controllers/sync-oplog/oplog.controller'
import AiController from './controllers/ai/ai.controller'

export const routes = {
  settings: SettingsController,
  songs: SongsController,
  themes: ThemesController,
  media: MediaController,
  tagSongs: TagSongsController,
  bible: BibleController,
  schedule: ScheduleController,
  presentations: PresentationsController,
  selectedScreens: SelectedScreensController,
  fonts: FontsController,
  stageScreenConfig: StageScreenConfigController,
  oplog: OplogController,
  ai: AiController,
}
