import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { useLayoutEffect, useRef, useState } from 'react'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { Play, Pause, Rewind, RotateCcw, Volume1 } from 'lucide-react'
import { Volume2, VolumeX } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/popover'
import { Button } from '@/ui/button'
import { Slider } from '@/ui/slider'

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
            onEnded={handleEnded}
          />
        </div>
        <div className="flex items-center gap-2 w-full px-28 bg-background/80 p-2 rounded shadow z-10">
          {/* Control de volumen con popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="Volumen">
                {volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 flex flex-col items-center gap-2">
              <span className="text-xs">Volumen</span>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[volume]}
                onValueChange={([val]) => handleVolumeChange(val)}
                className="w-full"
              />
              <span className="text-xs">{Math.round(volume * 100)}%</span>
            </PopoverContent>
          </Popover>
          <Button
            variant={autoRewind ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setAutoRewind((v) => !v)}
            title="Rebobinación automática"
            aria-label={
              autoRewind ? 'Desactivar rebobinación automática' : 'Activar rebobinación automática'
            }
            aria-pressed={autoRewind}
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
          {/* Reinicio manual */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRestart}
            title="Reiniciar video"
            aria-label="Reiniciar video"
          >
            <Rewind className="w-5 h-5" />
          </Button>
          {/* Play/Pause */}
          {isPlaying ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePause}
              title="Pausar video"
              aria-label="Pausar video"
            >
              <Pause className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlay}
              title="Reproducir video"
              aria-label="Reproducir video"
            >
              <Play className="w-5 h-5" />
            </Button>
          )}
          {/* Barra de progreso */}
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
  // Calcular centésimas de segundo (0-59)
  const centiseconds = Math.floor((time - Math.floor(time)) * 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}:${centiseconds.toString().padStart(2, '0')}`
}
