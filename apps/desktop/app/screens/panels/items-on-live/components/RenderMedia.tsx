import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { useQuery } from '@tanstack/react-query'
import { Api } from '@ecclesia/queries'
import VideoLiveControls from './VideoLiveControls'
import { isDocumentMediaType } from '../liveRenderTarget'

export const RenderMedia = () => {
  const { itemOnLive, media } = useSchedule()
  const { sendLiveMediaState, liveScreensReady } = useLive()

  const mediaId = itemOnLive?.type === 'MEDIA' ? Number(itemOnLive.accessData) : null
  const contextMediaItem = useMemo(
    () => (mediaId != null ? media.find((m) => m.id === mediaId) : undefined),
    [media, mediaId]
  )

  const { data: fetchedMedia } = useQuery({
    ...Api.query.media.getMediaByIds({ body: { ids: mediaId != null ? [mediaId] : [] } }),
    enabled: mediaId != null && contextMediaItem == null
  })

  const resolvedMediaItem = contextMediaItem ?? fetchedMedia?.[0]
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [autoRewind, setAutoRewind] = useState(false)
  const [volume, setVolume] = useState(1)
  const { buildMediaUrl } = useMediaServer()
  // Rebobinación automática: si termina el video y está activado, reinicia
  const handleEnded = () => {
    if (autoRewind && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play()
      setIsPlaying(true)
      sendLiveMediaState({ action: 'restart', time: 0 })
    } else {
      setIsPlaying(false)
    }
  }

  // Control de volumen
  const handleVolumeChange = (val: number) => {
    setVolume(val)
    if (videoRef.current) {
      videoRef.current.volume = val
    }
  }

  const handlePlay = () => {
    setIsPlaying(true)
    sendLiveMediaState({ action: 'play', time: videoRef.current?.currentTime || 0 })
    videoRef.current?.play()
  }
  const handlePause = () => {
    setIsPlaying(false)
    sendLiveMediaState({ action: 'pause', time: videoRef.current?.currentTime || 0 })
    videoRef.current?.pause()
  }
  const handleSeek = (time: number) => {
    setCurrentTime(time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
    sendLiveMediaState({ action: 'seek', time })
  }
  const handleRestart = () => {
    setCurrentTime(0)
    setIsPlaying(true)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play()
    }
    sendLiveMediaState({ action: 'restart', time: 0 })
  }

  useLayoutEffect(() => {
    if (!videoRef.current) return

    if (liveScreensReady) {
      handlePlay()
      setTimeout(() => {
        // Forzar sincronización después de un breve retraso para asegurar que las pantallas estén sincronizadas
        sendLiveMediaState({ action: 'seek', time: videoRef.current?.currentTime || 0 })
      }, 50)
    } else {
      handlePause()
    }
  }, [liveScreensReady, itemOnLive?.accessData])

  if (!itemOnLive || itemOnLive.type !== 'MEDIA') {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No se encontró el medio seleccionado.
      </div>
    )
  }

  if (!resolvedMediaItem) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Cargando medio...
      </div>
    )
  }

  const mediaItem = resolvedMediaItem

  if (mediaItem.type === 'IMAGE') {
    return (
      <div className="flex items-center justify-center h-full">
        <img
          src={buildMediaUrl(mediaItem.filePath)}
          alt={mediaItem.name}
          className="max-h-[70vh] max-w-full object-contain rounded shadow"
        />
      </div>
    )
  }

  if (mediaItem.type === 'VIDEO') {
    // Solo autoreproducir cuando allLiveScreensOpened es true
    // Desactivar autoPlay en el tag video, controlar por useEffect
    // Cuando allLiveScreensOpened cambia a true, reproducir el video
    // Si cambia a false, pausar

    return (
      <div className="flex flex-col h-full w-full items-center justify-center gap-2 p-2">
        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          <video
            key={mediaItem.filePath}
            autoPlay={liveScreensReady}
            playsInline
            preload="metadata"
            ref={videoRef}
            src={buildMediaUrl(mediaItem.filePath)}
            className="max-h-full max-w-full rounded shadow"
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onEnded={handleEnded}
          />
        </div>
        <VideoLiveControls
          className="flex items-center gap-2 w-full px-28 bg-background/80 p-2 rounded shadow z-10"
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          autoRewind={autoRewind}
          onToggleAutoRewind={() => setAutoRewind((prev) => !prev)}
          onVolumeChange={handleVolumeChange}
          onSeek={handleSeek}
          onPlay={handlePlay}
          onPause={handlePause}
          onRestart={handleRestart}
        />
      </div>
    )
  }

  // Un PDF/PPTX se controla con el render de presentaciones (ver `liveRenderTarget.ts`).
  // Si llega aquí es que no tiene presentación vinculada: import incompleto o borrada.
  if (isDocumentMediaType(mediaItem.type)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1 p-4 text-center text-muted-foreground">
        <span className="text-sm font-medium">
          Este {mediaItem.type} no tiene diapositivas disponibles.
        </span>
        <span className="text-xs">
          Vuelve a importarlo desde la biblioteca de medios para regenerarlas.
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Tipo de medio no soportado.
    </div>
  )
}

