import { Pause, Play, Rewind, RotateCcw, Volume1, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { Slider } from '@/ui/slider'

type Props = {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  onPlay: () => void
  onPause: () => void
  onRestart: () => void
  onSeek: (time: number) => void
  onVolumeChange: (volume: number) => void
  autoRewind?: boolean
  onToggleAutoRewind?: () => void
  className?: string
}

const formatTime = (time: number) => {
  if (!Number.isFinite(time) || time < 0) return '0:00:00'

  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  const centiseconds = Math.floor((time - Math.floor(time)) * 60)

  return `${minutes}:${seconds.toString().padStart(2, '0')}:${centiseconds.toString().padStart(2, '0')}`
}

export default function VideoLiveControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlay,
  onPause,
  onRestart,
  onSeek,
  onVolumeChange,
  autoRewind,
  onToggleAutoRewind,
  className
}: Props) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0
  const safeTime = Math.min(Math.max(currentTime, 0), safeDuration || Math.max(currentTime, 0))

  return (
    <div
      className={
        className || 'flex items-center gap-2 w-full bg-background/80 p-2 rounded shadow z-10'
      }
    >
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" title="Volumen" aria-label="Volumen">
            {volume === 0 ? (
              <VolumeX className="size-5" />
            ) : volume < 0.5 ? (
              <Volume1 className="size-5" />
            ) : (
              <Volume2 className="size-5" />
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
            onValueChange={([val]) => onVolumeChange(val)}
            className="w-full"
          />
          <span className="text-xs">{Math.round(volume * 100)}%</span>
        </PopoverContent>
      </Popover>

      {typeof autoRewind === 'boolean' && onToggleAutoRewind ? (
        <Button
          variant={autoRewind ? 'default' : 'ghost'}
          size="sm"
          onClick={onToggleAutoRewind}
          title="Rebobinación automática"
          aria-label={
            autoRewind ? 'Desactivar rebobinación automática' : 'Activar rebobinación automática'
          }
          aria-pressed={autoRewind}
        >
          <RotateCcw className="size-5" />
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRestart}
        title="Reiniciar video"
        aria-label="Reiniciar video"
      >
        <Rewind className="size-5" />
      </Button>

      {isPlaying ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onPause}
          title="Pausar video"
          aria-label="Pausar video"
        >
          <Pause className="size-5" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={onPlay}
          title="Reproducir video"
          aria-label="Reproducir video"
        >
          <Play className="size-5" />
        </Button>
      )}

      <Slider
        min={0}
        max={safeDuration > 0 ? safeDuration : 1}
        step={0.01}
        value={[safeDuration > 0 ? safeTime : 0]}
        onValueChange={([val]) => onSeek(val)}
        className="flex-1"
        disabled={safeDuration <= 0}
      />

      <div className="text-xs w-24 text-right tabular-nums whitespace-nowrap">
        {formatTime(safeTime)} / {formatTime(safeDuration)}
      </div>
    </div>
  )
}
