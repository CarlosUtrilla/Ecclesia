import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { useLayoutEffect, useRef, useState } from 'react'
import { useMediaServer } from '@/contexts/MediaServerContext'
import VideoLiveControls from './VideoLiveControls'

export const RenderMedia = () => {
  const { itemOnLive, media } = useSchedule()
  const { sendLiveMediaState, liveScreensReady } = useLive() // Debe implementarse para sincronizar estado
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
  }, [liveScreensReady])

  if (!itemOnLive || itemOnLive.type !== 'MEDIA') {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No se encontró el medio seleccionado.
      </div>
    )
  }

  const mediaItem = media.find((m) => m.id === Number(itemOnLive.accessData))

  if (!mediaItem) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No se encontró el medio seleccionado.
      </div>
    )
  }

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
            autoPlay={liveScreensReady}
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

  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Tipo de medio no soportado.
    </div>
  )
}

