import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { useLayoutEffect, useRef, useState } from 'react'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { Play, Pause, Rewind } from 'lucide-react'
import { Button } from '@/ui/button'
import { Slider } from '@/ui/slider'

export const RenderMedia = () => {
  const { itemOnLive, media } = useSchedule()
  const { sendLiveMediaState, liveScreensReady } = useLive() // Debe implementarse para sincronizar estado
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const { buildMediaUrl } = useMediaServer()

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
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value)
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
          />
        </div>
        <div className="flex items-center gap-2 w-full px-28 bg-background/80 p-2 rounded shadow z-10">
          <Button variant="ghost" size="icon" onClick={handleRestart} title="Reiniciar">
            <Rewind className="w-5 h-5" />
          </Button>
          {isPlaying ? (
            <Button variant="ghost" size="icon" onClick={handlePause} title="Pausar">
              <Pause className="w-5 h-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={handlePlay} title="Reproducir">
              <Play className="w-5 h-5" />
            </Button>
          )}
          <Slider
            min={0}
            max={duration}
            step={0.01}
            value={[currentTime]}
            onValueChange={([val]) => handleSeek({ target: { value: val } } as any)}
            className="flex-1"
          />
          <div className="text-xs w-20 text-right tabular-nums items-center whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Tipo de medio no soportado.
    </div>
  )
}

// Formatea segundos a mm:ss:ms (ms máximo 60)
function formatTime(time: number) {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  // Redondear ms a múltiplos de 60ms, nunca mostrar 100ms
  const ms = Math.round(((time - Math.floor(time)) * 1000) / 60) * 60
  // Si ms llega a 60, sumar 1s y poner ms en 0
  let displaySeconds = seconds
  let displayMs = ms
  let displayMinutes = minutes
  if (ms >= 60) {
    displaySeconds += 1
    displayMs = 0
    if (displaySeconds >= 60) {
      displayMinutes += 1
      displaySeconds = 0
    }
  }
  return `${displayMinutes}:${displaySeconds.toString().padStart(2, '0')}:${displayMs.toString().padStart(2, '0')}`
}
