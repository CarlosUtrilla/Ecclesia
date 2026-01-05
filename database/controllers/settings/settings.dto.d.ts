import { SettingOptions } from '@prisma/client'

export type SettingsUpdateDTO = {
  key: SettingOptions
  value: string
}
