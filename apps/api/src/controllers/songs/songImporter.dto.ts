export type HolyricsSongDTO = {
  id: number
  title: string
  artist: string
  author: string
  note: string
  copyright: string
  language: string
  key: string
  bpm: number
  time_sig: string
  midi: any
  order: string
  arrangements: any[]
  lyrics: {
    full_text: string
    full_text_with_comment: string | null
    paragraphs: {
      number: number
      description: string
      text: string
      text_with_comment: string | null
    }[]
  }
  full_text_with_comment: string | null
  paragraphs: any[]
  streaming: { audio: any; backing_track: any }
  extras: { extra: string }
}
