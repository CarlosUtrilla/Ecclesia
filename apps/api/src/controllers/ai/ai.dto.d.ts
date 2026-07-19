export type SaveProviderConfigDTO = {
  provider: 'openai' | 'anthropic' | 'gemini'
  apiKey?: string
  model?: string
}

export type ExtractFromTextDTO = {
  text: string
}

export type ExtractFromPdfDTO = {
  pdfPath: string
}

export type ExtractFromDocxDTO = {
  docxPath: string
}

export type AIProviderConfigDTO = {
  provider: string
  model: string
  hasKey: boolean
}

export type BibleReferenceDTO = {
  book: string
  bookShort?: string
  chapter: number
  verseStart: number
  verseEnd?: number
}

export type ExtractedContentDTO = {
  references: BibleReferenceDTO[]
  title?: string
  summary?: string
}
