import SettingsController from './controllers/settings/settings.controller'
import SongsController from './controllers/songs/songs.controller'
import { ThemesController } from './controllers/themes/themes.controller'

export const routes = {
  setttings: SettingsController,
  songs: SongsController,
  themes: ThemesController
}
