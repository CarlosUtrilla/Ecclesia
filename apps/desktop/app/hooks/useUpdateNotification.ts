import { useEffect, useState } from 'react'

export type UpdateNotificationStatus = 'idle' | 'available' | 'downloading' | 'downloaded'

export type UpdateNotificationState = {
  status: UpdateNotificationStatus
  version: string | null
  downloadPercent: number
  dismissed: boolean
}

export type UseUpdateNotificationReturn = UpdateNotificationState & {
  installNow: () => void
  dismiss: () => void
}

export function useUpdateNotification(): UseUpdateNotificationReturn {
  const [status, setStatus] = useState<UpdateNotificationStatus>('idle')
  const [version, setVersion] = useState<string | null>(null)
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const offAvailable = window.updaterAPI.onUpdateAvailable((info) => {
      setStatus('available')
      setVersion(info.version)
      setDismissed(false)
    })

    const offProgress = window.updaterAPI.onDownloadProgress((progress) => {
      setStatus('downloading')
      setDownloadPercent(Math.round(progress.percent))
    })

    const offDownloaded = window.updaterAPI.onUpdateDownloaded(() => {
      setStatus('downloaded')
      setDownloadPercent(100)
      // Una vez descargada, disparar el flujo de cierre automáticamente
      window.windowAPI.triggerClose()
    })

    return () => {
      offAvailable()
      offProgress()
      offDownloaded()
    }
  }, [])

  const installNow = () => {
    if (status === 'available') {
      setStatus('downloading')
      window.updaterAPI.downloadUpdate()
    } else if (status === 'downloaded') {
      window.windowAPI.triggerClose()
    }
  }

  const dismiss = () => {
    setDismissed(true)
  }

  return { status, version, downloadPercent, dismissed, installNow, dismiss }
}
