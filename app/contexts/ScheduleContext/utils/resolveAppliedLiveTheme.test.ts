import type { ScheduleItem } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { BlankTheme } from '@/hooks/useThemes'
import { resolveAppliedLiveTheme } from './resolveAppliedLiveTheme'

const selectedTheme = {
  ...BlankTheme,
  id: 99,
  name: 'Tema seleccionado'
}

describe('resolveAppliedLiveTheme', () => {
  it('deberia devolver el tema seleccionado para items no presentation', () => {
    const songItem = {
      id: 'song-id',
      accessData: '12',
      order: 1,
      scheduleId: 1,
      type: 'SONG',
      updatedAt: new Date()
    } satisfies ScheduleItem

    expect(resolveAppliedLiveTheme(songItem, selectedTheme)).toBe(selectedTheme)
  })

  it('deberia devolver BlankTheme para presentation', () => {
    const presentationItem = {
      id: 'presentation-id',
      accessData: '8',
      order: 1,
      scheduleId: 1,
      type: 'PRESENTATION',
      updatedAt: new Date()
    } satisfies ScheduleItem

    expect(resolveAppliedLiveTheme(presentationItem, selectedTheme)).toBe(BlankTheme)
  })
})