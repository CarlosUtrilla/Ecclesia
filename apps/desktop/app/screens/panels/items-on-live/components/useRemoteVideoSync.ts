import { RefObject, useEffect, useRef, useState } from 'react'
import { Api } from '@ecclesia/queries'
import { useRemoteMode } from '@/contexts/RemoteModeContext'

type PlaybackState = {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  /** Solo el vídeo directo en vivo tiene rebobinado automático; `undefined` si no aplica. */
  autoRewind?: boolean
}

type PlaybackHandlers = {
  play: () => void
  pause: () => void
  restart: () => void
  seek: (time: number) => void
  volumeChange: (volume: number) => void
  setAutoRewind?: (autoRewind: boolean) => void
}

type Props = {
  /** `Media.filePath` del vídeo que controla este panel; `null` si no hay vídeo. */
  path: string | null
  videoRef: RefObject<HTMLVideoElement | null>
  state: PlaybackState
  handlers: PlaybackHandlers
}

const STATUS_INTERVAL_MS = 500
// Tras aplicar una orden remota, el host re-publica enseguida para que el remoto no espere
// al siguiente tick (el estado de React ya se ha asentado para entonces).
const STATUS_AFTER_COMMAND_MS = 50
// Tras una acción propia, el remoto ignora los estados del host durante este margen: los
// que ya venían en camino son anteriores a la orden y harían rebotar el control.
const OPTIMISTIC_HOLD_MS = 400
// Desfase tolerado entre la vista previa del remoto y el host antes de saltar.
const PREVIEW_DRIFT_TOLERANCE_S = 1

/**
 * Puente del control de vídeo en vivo entre host y remotos.
 *
 * - Host: aplica las órdenes (`liveMediaCommand`) y ajustes (`liveMediaSettings`) de los
 *   remotos con sus propios handlers, así sus pantallas y su panel siguen en sincronía, y
 *   publica su estado con `liveMediaStatus`.
 * - Remoto: su panel no reproduce nada en vivo, así que muestra el estado del host,
 *   actualiza los controles de forma optimista al pulsarlos y arrastra su vista previa
 *   (siempre silenciada) para que la imagen acompañe a la barra.
 *
 * Los handlers devueltos son los que debe usar la UI: en el remoto, además de la orden,
 * llevan la actualización optimista y el envío de volumen/rebobinado.
 */
export default function useRemoteVideoSync({ path, videoRef, state, handlers }: Props) {
  const { isRemoteMode } = useRemoteMode()
  const [hostStatus, setHostStatus] = useState<PlaybackState | null>(null)
  const holdUntilRef = useRef(0)

  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const localStateRef = useRef(state)
  localStateRef.current = state

  const emitStatus = () => {
    if (!path) return
    Api.socket.emit.liveMediaStatus({ path, ...localStateRef.current })
  }
  const emitStatusRef = useRef(emitStatus)
  emitStatusRef.current = emitStatus

  // Host: obedecer órdenes y ajustes de los remotos dirigidos a este vídeo.
  useEffect(() => {
    if (isRemoteMode || !path) return
    const timeouts: number[] = []
    const emitSoon = () => {
      timeouts.push(window.setTimeout(() => emitStatusRef.current(), STATUS_AFTER_COMMAND_MS))
    }

    const unsubCommand = Api.socket.listen.liveMediaCommand((command) => {
      if (command.path && command.path !== path) return
      const current = handlersRef.current
      if (command.action === 'play') current.play()
      else if (command.action === 'pause') current.pause()
      else if (command.action === 'restart') current.restart()
      else current.seek(command.time)
      emitSoon()
    })

    const unsubSettings = Api.socket.listen.liveMediaSettings((settings) => {
      if (settings.path !== path) return
      const current = handlersRef.current
      if (typeof settings.volume === 'number') current.volumeChange(settings.volume)
      if (typeof settings.autoRewind === 'boolean') current.setAutoRewind?.(settings.autoRewind)
      emitSoon()
    })

    return () => {
      unsubCommand()
      unsubSettings()
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [isRemoteMode, path])

  // Host: publicar el estado. Periódico para que la barra del remoto avance y para que
  // un remoto que se conecta a mitad reciba el estado sin pedirlo; inmediato en cada
  // cambio discreto (play/pausa, duración, volumen, rebobinado).
  useEffect(() => {
    if (isRemoteMode || !path) return
    emitStatusRef.current()
    const interval = window.setInterval(() => emitStatusRef.current(), STATUS_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [isRemoteMode, path, state.isPlaying, state.duration, state.volume, state.autoRewind])

  // Remoto: escuchar el estado del host para este vídeo.
  useEffect(() => {
    setHostStatus(null)
    if (!isRemoteMode || !path) return
    return Api.socket.listen.liveMediaStatus((status) => {
      if (status.path !== path) return
      if (Date.now() < holdUntilRef.current) return
      setHostStatus({
        isPlaying: status.isPlaying,
        currentTime: status.currentTime,
        duration: status.duration,
        volume: status.volume,
        autoRewind: status.autoRewind
      })
    })
  }, [isRemoteMode, path])

  // Remoto: el audio sale por el host; la vista previa nunca suena en esta PC.
  useEffect(() => {
    if (!isRemoteMode) return
    const video = videoRef.current
    if (video) video.muted = true
  }, [isRemoteMode, path, videoRef])

  // Remoto: la vista previa sigue al host.
  useEffect(() => {
    if (!isRemoteMode || !hostStatus) return
    const video = videoRef.current
    if (!video) return
    video.muted = true
    if (Math.abs(video.currentTime - hostStatus.currentTime) > PREVIEW_DRIFT_TOLERANCE_S) {
      video.currentTime = hostStatus.currentTime
    }
    if (hostStatus.isPlaying && video.paused) {
      video.play().catch(() => {
        // noop: la vista previa puede no cargar en el remoto; la barra sigue al host
      })
    } else if (!hostStatus.isPlaying && !video.paused) {
      video.pause()
    }
  }, [isRemoteMode, hostStatus, videoRef])

  const applyOptimistic = (patch: Partial<PlaybackState>) => {
    if (!isRemoteMode) return
    holdUntilRef.current = Date.now() + OPTIMISTIC_HOLD_MS
    setHostStatus((previous) => ({ ...(previous ?? localStateRef.current), ...patch }))
  }

  const emitSettings = (settings: { volume?: number; autoRewind?: boolean }) => {
    if (!path) return
    Api.socket.emit.liveMediaSettings({ path, ...settings })
  }

  const wrappedHandlers: PlaybackHandlers = {
    play: () => {
      applyOptimistic({ isPlaying: true })
      handlers.play()
    },
    pause: () => {
      applyOptimistic({ isPlaying: false })
      handlers.pause()
    },
    restart: () => {
      applyOptimistic({ isPlaying: true, currentTime: 0 })
      handlers.restart()
    },
    seek: (time) => {
      applyOptimistic({ currentTime: time })
      handlers.seek(time)
    },
    volumeChange: (volume) => {
      handlers.volumeChange(volume)
      if (!isRemoteMode) return
      applyOptimistic({ volume })
      emitSettings({ volume })
    },
    setAutoRewind: handlers.setAutoRewind
      ? (autoRewind) => {
          handlers.setAutoRewind?.(autoRewind)
          if (!isRemoteMode) return
          applyOptimistic({ autoRewind })
          emitSettings({ autoRewind })
        }
      : undefined
  }

  const displayState: PlaybackState =
    isRemoteMode && hostStatus
      ? {
          ...hostStatus,
          duration: hostStatus.duration > 0 ? hostStatus.duration : state.duration,
          autoRewind: hostStatus.autoRewind ?? state.autoRewind
        }
      : state

  return { state: displayState, handlers: wrappedHandlers }
}
