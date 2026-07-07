import { z } from 'zod'

export const SyncSettingsSchema = z.object({
  enabled: z.boolean(),
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
