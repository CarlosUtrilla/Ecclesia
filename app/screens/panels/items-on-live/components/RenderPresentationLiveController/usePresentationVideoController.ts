import { RefObject, SyntheticEvent, useEffect, useRef, useState } from 'react'

type LiveMediaAction = 'play' | 'pause' | 'seek' | 'restart'

type SendLiveMediaState = (payload: { action: LiveMediaAction; time: number }) => void

type Props = {
  controllerVideoRef: RefObject<HTMLVideoElement | null>
  sendLiveMediaState: SendLiveMediaState
  activeSlideHasVideo: boolean
  activeSlideVideoBehavior: 'auto' | 'manual'
  activeVideoDurationHint: number
  activeVideoUrl: string | null
  activeSlideVideoLoop: boolean
  liveScreensReady: boolean
  slideIndex: number
}

export default function usePresentationVideoController({
  controllerVideoRef,
  sendLiveMediaState,
  activeSlideHasVideo,
  activeSlideVideoBehavior,
  activeVideoDurationHint,
  activeVideoUrl,
  activeSlideVideoLoop,
  liveScreensReady,
  slideIndex
}: Props) {
  const sendLiveMediaStateRef = useRef(sendLiveMediaState)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    sendLiveMediaStateRef.current = sendLiveMediaState
  }, [sendLiveMediaState])

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(activeVideoDurationHint)

    const localVideo = controllerVideoRef.current
    if (localVideo) {
      localVideo.pause()
      localVideo.currentTime = 0
    }

    if (!liveScreensReady) return

    let retryTimeouts: number[] = []

    const queueSyncPlay = () => {
      const syncDelays = [120, 320, 700]
      retryTimeouts = syncDelays.map((delayMs) =>
        window.setTimeout(() => {
          sendLiveMediaStateRef.current({ action: 'seek', time: 0 })
          sendLiveMediaStateRef.current({ action: 'play', time: 0 })
        }, delayMs)
      )
    }

    if (activeSlideHasVideo) {
      if (activeSlideVideoBehavior === 'auto') {
        setIsPlaying(true)
        if (localVideo) {
          localVideo.currentTime = 0
          localVideo.play().catch(() => {
            // noop: puede fallar temporalmente por política de autoplay
          })
        }

        // Reintentos cortos para cubrir desmontaje/montaje al cambiar de slide.
        queueSyncPlay()
      } else {
        sendLiveMediaStateRef.current({ action: 'seek', time: 0 })
        sendLiveMediaStateRef.current({ action: 'pause', time: 0 })
      }
    }

    return () => {
      retryTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [
    activeSlideHasVideo,
    activeSlideVideoBehavior,
    activeVideoDurationHint,
    controllerVideoRef,
    liveScreensReady,
    slideIndex
  ])

  useEffect(() => {
    if (!activeVideoUrl || duration > 0) return

    let attempts = 0
    const maxAttempts = 20
    const pollInterval = window.setInterval(() => {
      const nextDuration = Number(controllerVideoRef.current?.duration || 0)
      if (Number.isFinite(nextDuration) && nextDuration > 0) {
        setDuration(nextDuration)
        window.clearInterval(pollInterval)
        return
      }

      attempts += 1
      if (attempts >= maxAttempts) {
        window.clearInterval(pollInterval)
      }
    }, 150)

    return () => window.clearInterval(pollInterval)
  }, [activeVideoUrl, controllerVideoRef, duration])

  const handlePlay = () => {
    controllerVideoRef.current?.play().catch(() => {
      // noop: el controlador local puede no iniciar por autoplay policy
    })
    setIsPlaying(true)
    sendLiveMediaStateRef.current({ action: 'play', time: currentTime })
  }

  const handlePause = () => {
    controllerVideoRef.current?.pause()
    setIsPlaying(false)
    sendLiveMediaStateRef.current({ action: 'pause', time: currentTime })
  }

  const handleRestart = () => {
    if (controllerVideoRef.current) {
      controllerVideoRef.current.currentTime = 0
      controllerVideoRef.current.play().catch(() => {
        // noop
      })
    }
    setIsPlaying(true)
    setCurrentTime(0)
    sendLiveMediaStateRef.current({ action: 'restart', time: 0 })
  }

  const handleSeek = (time: number) => {
    const nextTime = Math.max(0, Math.min(time, duration || time))
    if (controllerVideoRef.current) {
      controllerVideoRef.current.currentTime = nextTime
    }
    setCurrentTime(nextTime)
    sendLiveMediaStateRef.current({ action: 'seek', time: nextTime })
  }

  const handleVolumeChange = (nextVolume: number) => {
    if (controllerVideoRef.current) {
      controllerVideoRef.current.volume = nextVolume
    }
    setVolume(nextVolume)
  }

  const handleControllerTimeUpdate = () => {
    const localVideo = controllerVideoRef.current
    if (!localVideo) return
    setCurrentTime(localVideo.currentTime)
  }

  const handleControllerEnded = () => {
    if (activeSlideVideoLoop) {
      setCurrentTime(0)
      setIsPlaying(true)
      return
    }

    setIsPlaying(false)
    setCurrentTime(duration)
  }

  const handleHiddenVideoPlay = () => {
    setIsPlaying(true)
  }

  const handleHiddenVideoPause = () => {
    setIsPlaying(false)
  }

  const handleHiddenVideoLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
    const nextDuration = event.currentTarget.duration
    const safeDuration = Number.isFinite(nextDuration) ? nextDuration : 0
    setDuration(safeDuration)
    if (controllerVideoRef.current) {
      controllerVideoRef.current.volume = volume
    }
  }

  const handleHiddenVideoDurationChange = (event: SyntheticEvent<HTMLVideoElement>) => {
    const nextDuration = event.currentTarget.duration
    if (Number.isFinite(nextDuration) && nextDuration > 0) {
      setDuration(nextDuration)
    }
  }

  const handleHiddenVideoVolumeChange = (event: SyntheticEvent<HTMLVideoElement>) => {
    setVolume(event.currentTarget.volume)
  }

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    handlePlay,
    handlePause,
    handleRestart,
    handleSeek,
    handleVolumeChange,
    handleControllerTimeUpdate,
    handleControllerEnded,
    handleHiddenVideoPlay,
    handleHiddenVideoPause,
    handleHiddenVideoLoadedMetadata,
    handleHiddenVideoDurationChange,
    handleHiddenVideoVolumeChange
  }
}
