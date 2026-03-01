import { z } from 'zod'

export const SyncSettingsSchema = z.object({
  enabled: z.boolean(),
  workspaceId: z.string().trim().max(120),
  deviceName: z.string().trim().min(2, 'Ingresa un nombre de dispositivo').max(80),
  conflictStrategy: z.enum(['lastWriteWins', 'askBeforeOverwrite', 'primaryDevice']),
  primaryDeviceName: z.string().trim().max(80).optional(),
  autoOnStart: z.boolean(),
  autoEvery5Min: z.boolean(),
  autoOnSave: z.boolean(),
  autoOnClose: z.boolean()
}).superRefine((value, context) => {
  if (!value.enabled) {
    return
  }

  if (value.conflictStrategy === 'primaryDevice' && !value.primaryDeviceName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['primaryDeviceName'],
      message: 'Define el nombre del dispositivo principal'
    })
  }
})

export type SyncSettingsForm = z.infer<typeof SyncSettingsSchema>
