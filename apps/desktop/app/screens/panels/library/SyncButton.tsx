import { useEffect, useState } from 'react'
import { Button } from '@/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { Api } from '@ecclesia/queries'

export default function SyncButton() {
  const [isConnected, setIsConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)

  useEffect(() => {
    Api.fetch.sync
      .getStatus()
      .then((s: { connected?: boolean } | null) => setIsConnected(!!s?.connected))
      .catch(() => {})

    const unsubProgress = Api.socket.listen.syncProgress((data) => {
      if (data.error) {
        setIsSyncing(false)
        setSyncProgress(0)
      } else if (data.progress >= 100) {
        setSyncProgress(100)
        setIsSyncing(false)
        Api.fetch.sync
          .getStatus()
          .then((s: { connected?: boolean } | null) => setIsConnected(!!s?.connected))
          .catch(() => {})
      } else if (data.progress > 0) {
        setIsSyncing(true)
        setSyncProgress(data.progress)
      }
    })

    return () => {
      unsubProgress()
    }
  }, [])

  if (!isConnected) return null

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => !isSyncing && Api.fetch.oplog.syncCycle()}
    >
      {isSyncing ? (
        <span className="text-xs text-primary">
          {syncProgress > 0 ? `Sincronizando ${syncProgress}%` : 'Sincronizando...'}
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
