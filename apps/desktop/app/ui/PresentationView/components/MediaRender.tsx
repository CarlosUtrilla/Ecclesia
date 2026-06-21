import { PresentationViewItems } from '../types'
import type { Media } from '@ecclesia/api'
import { Api } from '@ecclesia/queries'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { getMediaType } from '@/lib/utils'
import { CSSProperties, memo, useId, useLayoutEffect, useMemo, useRef } from 'react'

type MediaRenderProps = {
  currentItem: PresentationViewItems
  live?: boolean
  externalBuildMediaUrl?: (filePath: string) => string
}

function MediaRenderComponent({
  currentItem,
  live = false,
  externalBuildMediaUrl
}: MediaRenderProps) {
  const videoId = useId()

  const { buildMediaUrl: contextBuildMediaUrl } = useMediaServer()
  const buildMediaUrl = externalBuildMediaUrl || contextBuildMediaUrl
  const itemData = currentItem as PresentationViewItems & Media
  const thumbnailUrl = buildMediaUrl(itemData.thumbnail || '')
  const originalUrl =
    (itemData as PresentationViewItems & { mediaUrl?: string }).mediaUrl ||
    buildMediaUrl(itemData.filePath)


  const type = getMediaType(itemData.format)
  const shouldLoop = currentItem.videoLoop === true

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastPlayStateRef = useRef<{ time: number; action: string } | null>(null)

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

    const shouldSyncTimeOnPlay = (requestedTime: number) => {
      const video = videoRef.current
      if (!video) return false

      if (requestedTime === 0 && video.currentTime > 0.08) {
        return false
      }

      return Math.abs(video.currentTime - requestedTime) > 0.25
    }

    const tryPlay = (time: number) => {
      const video = videoRef.current
      if (!video) return
      if (shouldSyncTimeOnPlay(time)) {
        video.currentTime = time
      }
      video.play().catch((err) => {
        if (err.name === 'AbortError') {
          const onFocus = () => {
            video.play()
            window.removeEventListener('focus', onFocus)
          }
          window.addEventListener('focus', onFocus)
        }
      })
    }

    const unsubscribe = Api.socket.listen.liveMediaState((state) => {
      const video = videoRef.current
      lastPlayStateRef.current = state
      if (!video) return

      if (state.volume !== undefined) {
        video.volume = state.volume
        return
      }

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

    const onFocus = () => {
      const video = videoRef.current
      const pendingState = lastPlayStateRef.current
      if (!video || !pendingState) return
      if (pendingState.action === 'play') {
        tryPlay(pendingState.time)
      }
    }

    window.addEventListener('focus', onFocus)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [live, type, currentItem.id])

  const renderMedia = () => {
    if (!live) {
      if (!thumbnailUrl) return null
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
        if (!originalUrl) {
          if (thumbnailUrl) {
            return (
              <img
                src={thumbnailUrl}
                alt={itemData.name}
                className="object-contain"
                style={mediaElementStyle}
              />
            )
          }
          return null
        }
        return (
          <video
            ref={videoRef}
            autoPlay={live}
            controls={false}
            src={originalUrl}
            className="object-contain"
            style={mediaElementStyle}
            loop={shouldLoop}
            playsInline
            preload="auto"
          />
        )
      } else {
        if (!originalUrl) {
          if (thumbnailUrl) {
            return (
              <img
                src={thumbnailUrl}
                alt={itemData.name}
                className="object-contain"
                style={mediaElementStyle}
              />
            )
          }
          return null
        }
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
  const prevItem = prevProps.currentItem as PresentationViewItems & Partial<Media> & { mediaUrl?: string }
  const nextItem = nextProps.currentItem as PresentationViewItems & Partial<Media> & { mediaUrl?: string }

  return (
    prevProps.live === nextProps.live &&
    prevProps.externalBuildMediaUrl === nextProps.externalBuildMediaUrl &&
    prevItem.id === nextItem.id &&
    prevItem.filePath === nextItem.filePath &&
    prevItem.thumbnail === nextItem.thumbnail &&
    prevItem.format === nextItem.format &&
    prevItem.customStyle === nextItem.customStyle &&
    prevItem.mediaUrl === nextItem.mediaUrl &&
    prevProps.currentItem.videoLoop === nextProps.currentItem.videoLoop
  )
}

const MediaRender = memo(MediaRenderComponent, areMediaRenderPropsEqual)

export default MediaRender
