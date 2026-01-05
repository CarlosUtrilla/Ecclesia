import { useState, useEffect, createContext, useContext } from 'react'
import { sanitizeHTML } from '../../lib/utils'
import {
  PreviewPresentationContextType,
  PreviewPresentationProviderProps,
  PreviewPresentationsProps
} from './types'

const PreviewContext = createContext<PreviewPresentationContextType>(
  null as unknown as PreviewPresentationContextType
)

export function PreviewPresentationProvider({
  children,
  maxHeight
}: PreviewPresentationProviderProps) {
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const calculatePreviewSize = () => {
      const screenHeight = window.innerHeight
      const screenWidth = window.innerWidth
      const previewHeight = maxHeight || 150
      const previewWidth = (previewHeight / screenHeight) * screenWidth

      setPreviewSize({ width: previewWidth, height: previewHeight })
    }

    calculatePreviewSize()
    window.addEventListener('resize', calculatePreviewSize)

    return () => window.removeEventListener('resize', calculatePreviewSize)
  }, [])
  return <PreviewContext.Provider value={{ previewSize }}>{children}</PreviewContext.Provider>
}

export function PreviewPresentation({ text }: PreviewPresentationsProps) {
  const { previewSize } = useContext(PreviewContext)
  return (
    <div
      style={{
        width: `${previewSize.width}px`,
        height: `${previewSize.height}px`,
        overflow: 'auto'
      }}
      className="rounded-sm border relative bg-background"
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        dangerouslySetInnerHTML={{ __html: sanitizeHTML(text) }}
      ></div>
    </div>
  )
}
