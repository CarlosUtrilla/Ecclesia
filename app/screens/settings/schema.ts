import { z } from 'zod'

export const SyncSettingsSchema = z.object({
  enabled: z.boolean(),
  serverUrl: z.string().trim().url('Ingresa una URL válida').or(z.literal('')),
  workspaceId: z.string().trim().max(120),
  deviceName: z.string().trim().min(2, 'Ingresa un nombre de dispositivo').max(80)
})

export type SyncSettingsForm = z.infer<typeof SyncSettingsSchema>
