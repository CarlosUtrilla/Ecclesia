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

export const routes = {
  setttings: SettingsController,
  songs: SongsController,
  themes: ThemesController,
  media: MediaController,
  tagSongs: TagSongsController,
  bible: BibleController,
  schedule: ScheduleController,
  presentations: PresentationsController,
  selectedScreens: SelectedScreensController,
  fonts: FontsController
}
