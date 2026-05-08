export type StageTimer = {
  id?: string | number
  label?: string
  endsAt?: string | number
  endAt?: string | number
  remainingMs?: number
}

export type StageState = {
  message?: string | null
  timers?: StageTimer[]
  timerVisualMode?: 'compact' | 'broadcast'
  clock?: {
    hourFormat?: '12' | '24'
    showMeridiem?: boolean
  }
  focusMode?: boolean
}

export const DEFAULT_STATE: StageState = {
  message: null,
  timers: [],
  timerVisualMode: 'broadcast',
  clock: {
    hourFormat: '24',
    showMeridiem: false
  },
  focusMode: false
}

export type ResolvedTimer = {
  key: string
  label: string
  remainingMs: number
  value: string
}

export type ContainerSize = {
  width: number
  height: number
}
