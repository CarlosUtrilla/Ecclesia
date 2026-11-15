import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { Api } from '@ecclesia/queries'

// El mensaje llega como "2/4 Blobs — Escaneando…": en la barra solo cabe la fase; el
// detalle completo va en el tooltip.
const PHASE_NAMES: Record<string, string> = {
  Pull: 'descargando',
  Blobs: 'archivos',
  Push: 'subiendo',
  Purge: 'limpieza'
}

function phaseLabel(message: string): string {
  const match = /^\d\/\d (\w+)/.exec(message)
  const name = match ? PHASE_NAMES[match[1]] : undefined
  return name ? ` · ${name}` : ''
}

export default function SyncButton() {
  const [isConnected, setIsConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncMessage, setSyncMessage] = useState('')

  const refreshStatus = useCallback(() => {
    Api.fetch.oplog
      .getSyncStatus()
      .then((s: { connected?: boolean } | null) => setIsConnected(!!s?.connected))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshStatus()

    const unsubProgress = Api.socket.listen.syncProgress((data) => {
      if (data.error) {
        setIsSyncing(false)
        setSyncProgress(0)
      } else if (data.progress >= 100) {
        setSyncProgress(100)
        setIsSyncing(false)
        refreshStatus()
      } else if (data.progress > 0) {
        setIsSyncing(true)
        setSyncProgress(data.progress)
        setSyncMessage(data.message ?? '')
      }
    })

    const unsubSyncState = Api.socket.listen.syncState((data) => {
      setIsConnected(!!data.connected)
    })

    const handleFocus = () => refreshStatus()
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)

    return () => {
      unsubProgress()
      unsubSyncState()
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [refreshStatus])

  if (!isConnected) return null

  return (
    <Button
      size="sm"
      variant="ghost"
      title={isSyncing ? syncMessage : undefined}
      onClick={() => !isSyncing && Api.fetch.oplog.syncCycle()}
    >
      {isSyncing ? (
        <span className="text-xs text-primary">
          {syncProgress > 0
            ? `Sincronizando ${syncProgress}%${phaseLabel(syncMessage)}`
            : 'Sincronizando...'}
        </span>
      ) : (
        <>
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-xs">Sync</span>
        </>
      )}
    </Button>
  )
}
