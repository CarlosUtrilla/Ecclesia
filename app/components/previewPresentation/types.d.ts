export type PreviewPresentationsProps = {
  text: string
}

export type PreviewPresentationContextType = {
  previewSize: { width: number; height: number }
}

export type PreviewPresentationProviderProps = {
  children: React.ReactNode
  maxHeight?: number
}
