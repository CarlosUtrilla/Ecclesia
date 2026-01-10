import SettingsController from './controllers/settings/settings.controller'
import SongsController from './controllers/songs/songs.controller'
import { ThemesController } from './controllers/themes/themes.controller'
import { MediaController } from './controllers/media/media.controller'
import { TagSongsController } from './controllers/tagSongs/tagSongs.controller'

export const routes = {
  setttings: SettingsController,
  songs: SongsController,
  themes: ThemesController,
  media: MediaController,
  tagSongs: TagSongsController
}
