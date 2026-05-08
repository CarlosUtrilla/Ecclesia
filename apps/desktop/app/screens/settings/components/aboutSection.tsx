import { useEffect, useState } from 'react'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Separator } from '@/ui/separator'
import { CheckCircle2, Download, Loader2, RefreshCw, XCircle } from 'lucide-react'

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export default function AboutSection() {
  const [version, setVersion] = useState<string>('...')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [downloadPercent, setDownloadPercent] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    window.updaterAPI.getVersion().then(setVersion)

    const offChecking = window.updaterAPI.onCheckingForUpdate(() => {
      setUpdateStatus('checking')
      setErrorMsg(null)
    })
    const offAvailable = window.updaterAPI.onUpdateAvailable((info) => {
      setUpdateStatus('available')
      setUpdateVersion(info.version)
    })
    const offNotAvailable = window.updaterAPI.onUpdateNotAvailable(() => {
      setUpdateStatus('not-available')
    })
    const offProgress = window.updaterAPI.onDownloadProgress((progress) => {
      setUpdateStatus('downloading')
      setDownloadPercent(Math.round(progress.percent))
    })
    const offDownloaded = window.updaterAPI.onUpdateDownloaded(() => {
      setUpdateStatus('downloaded')
    })
    const offError = window.updaterAPI.onError((msg) => {
      setUpdateStatus('error')
      setErrorMsg(msg)
    })

    return () => {
      offChecking()
      offAvailable()
      offNotAvailable()
      offProgress()
      offDownloaded()
      offError()
    }
  }, [])

  const handleCheckUpdates = () => {
    setUpdateStatus('checking')
    setErrorMsg(null)
    window.updaterAPI.checkForUpdates()

    // Timeout de seguridad: si en 15s no hay respuesta, volver a idle
    const timeout = setTimeout(() => {
      setUpdateStatus('not-available')
    }, 15_000)

    const offAvailable = window.updaterAPI.onUpdateAvailable(() => {
      clearTimeout(timeout)
      offAvailable()
      offNotAvailable()
    })
    const offNotAvailable = window.updaterAPI.onUpdateNotAvailable(() => {
      clearTimeout(timeout)
      offAvailable()
      offNotAvailable()
    })
  }

  const handleDownload = () => {
    setUpdateStatus('downloading')
    window.updaterAPI.downloadUpdate()
  }

  const handleInstall = () => {
    window.updaterAPI.installUpdate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acerca de Ecclesia</CardTitle>
        <CardDescription>Información de la aplicación y actualizaciones.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Identidad de la app */}
        <div className="flex items-center gap-4">
          <img
            src="./icon.png"
            alt="Ecclesia"
            className="size-16 rounded-xl"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
          <div>
            <p className="text-xl font-semibold">Ecclesia</p>
            <p className="text-sm text-muted-foreground">
              Versión{' '}
              <Badge variant="secondary" className="font-mono text-xs">
                {version}
              </Badge>
            </p>
          </div>
        </div>

        <Separator />

        {/* Estado de actualizaciones */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Actualizaciones</p>

          <UpdateStatusDisplay
            status={updateStatus}
            updateVersion={updateVersion}
            downloadPercent={downloadPercent}
            errorMsg={errorMsg}
          />

          <div className="flex gap-2">
            {(updateStatus === 'idle' ||
              updateStatus === 'not-available' ||
              updateStatus === 'error') && (
              <Button variant="outline" size="sm" onClick={handleCheckUpdates}>
                <RefreshCw className="size-4" />
                Buscar actualizaciones
              </Button>
            )}

            {updateStatus === 'available' && (
              <Button size="sm" onClick={handleDownload}>
                <Download className="size-4" />
                Descargar v{updateVersion}
              </Button>
            )}

            {updateStatus === 'downloaded' && (
              <Button size="sm" onClick={handleInstall}>
                <Download className="size-4" />
                Instalar y reiniciar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type UpdateStatusDisplayProps = {
  status: UpdateStatus
  updateVersion: string | null
  downloadPercent: number
  errorMsg: string | null
}

function UpdateStatusDisplay({
  status,
  updateVersion,
  downloadPercent,
  errorMsg
}: UpdateStatusDisplayProps) {
  if (status === 'idle') {
    return <p className="text-sm text-muted-foreground">No se ha verificado aún.</p>
  }

  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Buscando actualizaciones...
      </div>
    )
  }

  if (status === 'not-available') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-4" />
        La aplicación está actualizada.
      </div>
    )
  }

  if (status === 'available') {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
        <Download className="size-4" />
        Nueva versión disponible: <span className="font-mono font-medium">{updateVersion}</span>
      </div>
    )
  }

  if (status === 'downloading') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Descargando... {downloadPercent}%
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${downloadPercent}%` }}
          />
        </div>
      </div>
    )
  }

  if (status === 'downloaded') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-4" />
        Actualización lista para instalar.
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <XCircle className="size-4" />
        {errorMsg ?? 'Error al verificar actualizaciones.'}
      </div>
    )
  }

  return null
}
