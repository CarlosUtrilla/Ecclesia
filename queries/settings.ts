import api from '@api'
import { SettingOptions } from '@prisma/client'
import { queryOptions } from '@tanstack/react-query'

export const getAllSettingsQuery = (settings: SettingOptions[]) =>
  queryOptions({
    queryKey: ['settings', settings],
    queryFn: async () => {
      return await api.setttings.getSettings(settings)
    }
  })
