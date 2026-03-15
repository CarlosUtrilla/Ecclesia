import { PresentationViewItems } from '../types'
import type { Media } from '@prisma/client'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { getMediaType } from '@/lib/utils'
import { CSSProperties, memo, useId, useLayoutEffect, useMemo } from 'react'

type MediaRenderProps = {
  currentItem: PresentationViewItems
  live?: boolean
}

function MediaRenderComponent({ currentItem, live = false }: MediaRenderProps) {
  const videoId = useId()

  const { buildMediaUrl } = useMediaServer()
  const itemData = currentItem as PresentationViewItems & Media
  const thumbnailUrl = buildMediaUrl(itemData.thumbnail || '')
  const originalUrl = buildMediaUrl(itemData.filePath)

  const type = getMediaType(itemData.format)

  const mediaElementStyle = useMemo<CSSProperties>(() => {
    if (!currentItem.customStyle) {
      return {
        width: '100%',
        height: '100%'
      }
    }

    try {
      const parsed = JSON.parse(currentItem.customStyle) as {
        offsetX?: number
        offsetY?: number
        mediaWidth?: number
        mediaHeight?: number
      }

      const width = Number.isFinite(parsed.mediaWidth) ? Math.max(10, parsed.mediaWidth!) : 70
      const height = Number.isFinite(parsed.mediaHeight) ? Math.max(10, parsed.mediaHeight!) : 70
      const offsetX = Number.isFinite(parsed.offsetX) ? parsed.offsetX! : 0
      const offsetY = Number.isFinite(parsed.offsetY) ? parsed.offsetY! : 0

      return {
        width: `${width}%`,
        height: `${height}%`,
        transform: `translate(${offsetX}px, ${offsetY}px)`
      }
    } catch {
      return {
        width: '100%',
        height: '100%'
      }
    }
  }, [currentItem.customStyle])
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
      return (
        <img
          src={thumbnailUrl}
          alt={itemData.name}
          className="object-contain"
          style={mediaElementStyle}
        />
      )
    } else {
      if (type === 'video') {
        // Inicia muted para permitir autoplay
        return (
          <video
            id={videoId}
            controls={false}
            src={originalUrl}
            className="object-contain"
            style={mediaElementStyle}
            autoPlay
            loop
            muted
            playsInline
            onLoadedMetadata={(e) => {
              // Forzar play apenas el video esté listo
              e.currentTarget.play()
            }}
            preload="auto"
          />
        )
      } else {
        return (
          <img
            src={originalUrl}
            alt={itemData.name}
            className="object-contain"
            style={mediaElementStyle}
          />
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

function areMediaRenderPropsEqual(prevProps: MediaRenderProps, nextProps: MediaRenderProps) {
  const prevItem = prevProps.currentItem as PresentationViewItems & Partial<Media>
  const nextItem = nextProps.currentItem as PresentationViewItems & Partial<Media>

  return (
    prevProps.live === nextProps.live &&
    prevItem.id === nextItem.id &&
    prevItem.filePath === nextItem.filePath &&
    prevItem.thumbnail === nextItem.thumbnail &&
    prevItem.format === nextItem.format &&
    prevItem.customStyle === nextItem.customStyle
  )
}

const MediaRender = memo(MediaRenderComponent, areMediaRenderPropsEqual)

export default MediaRender
