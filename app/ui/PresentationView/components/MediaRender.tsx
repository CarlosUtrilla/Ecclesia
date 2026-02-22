import { PresentationViewItems } from '../types'
import { Media } from '@prisma/client'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { getMediaType } from '@/lib/utils'
import { useId, useLayoutEffect } from 'react'

type MediaRenderProps = {
  currentItem: PresentationViewItems
  live?: boolean
}

export default function MediaRender({ currentItem, live = false }: MediaRenderProps) {
  const videoId = useId()

  const { buildMediaUrl } = useMediaServer()
  const itemData = currentItem as PresentationViewItems & Media
  const thumbnailUrl = buildMediaUrl(itemData.thumbnail || '')
  const originalUrl = buildMediaUrl(itemData.filePath)

  const type = getMediaType(itemData.format)
  // Sincronización de media: escuchar eventos desde el controlador
  useLayoutEffect(() => {
    if (!live || type !== 'video') return
    const video = document.getElementById(videoId) as HTMLVideoElement | null
    let lastPlayState: { time: number; action: string } | null = null
    const tryPlay = (time: number) => {
      if (!video) return
      video.currentTime = time
      video.play().catch((err) => {
        if (err.name === 'AbortError') {
          // Reintentar cuando la ventana reciba el foco
          const onFocus = () => {
            video.play()
            window.removeEventListener('focus', onFocus)
          }
          window.addEventListener('focus', onFocus)
        }
      })
    }
    const unsuscribe = window.liveMediaAPI.onMediaState((state) => {
      // Buscar el video en el DOM y sincronizar
      console.log('Received live media state:', state)
      if (!video) return
      lastPlayState = { time: state.time, action: state.action }
      if (state.action === 'play') {
        tryPlay(state.time)
      } else if (state.action === 'pause') {
        video.currentTime = state.time
        video.pause()
      } else if (state.action === 'seek') {
        video.currentTime = state.time
      } else if (state.action === 'restart') {
        video.currentTime = 0
        tryPlay(0)
      }
    })
    // Reintentar play si la ventana recibe el foco y hay un estado pendiente
    const onFocus = () => {
      if (lastPlayState && lastPlayState.action === 'play') {
        tryPlay(lastPlayState.time)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => {
      if (unsuscribe) unsuscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const renderMedia = () => {
    if (!live) {
      return <img src={thumbnailUrl} alt={itemData.name} className="w-full h-full object-contain" />
    } else {
      if (type === 'video') {
        // Inicia muted para permitir autoplay
        return (
          <video
            id={videoId}
            controls={false}
            src={originalUrl}
            className="w-full h-full object-contain"
            muted
            onLoadedMetadata={(e) => {
              // Forzar play apenas el video esté listo
              e.currentTarget.play()
            }}
            preload="auto"
          />
        )
      } else {
        return (
          <img src={originalUrl} alt={itemData.name} className="w-full h-full object-contain" />
        )
      }
    }
  }
  return (
    <div className="bg-black w-full h-full flex items-center justify-center absolute inset-0">
      {renderMedia()}
    </div>
  )
}
