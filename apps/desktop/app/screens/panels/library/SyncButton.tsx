import { useEffect, useState } from 'react'
import { Button } from '@/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { onSyncProgress } from '@/lib/syncProgressService'

export default function SyncButton() {
  const [isConnected, setIsConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)

  useEffect(() => {
    window.googleDriveSyncAPI
      .getStatus()
      .then((s: { connected?: boolean } | null) => setIsConnected(!!s?.connected))
      .catch(() => {})

    const unsubProgress = onSyncProgress((data) => {
      setIsSyncing(data.syncing)
      setSyncProgress(data.progress)

      if (!data.syncing && !data.error) {
        window.googleDriveSyncAPI
          .getStatus()
          .then((s: { connected?: boolean } | null) => setIsConnected(!!s?.connected))
          .catch(() => {})
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
      onClick={() => !isSyncing && window.googleDriveSyncAPI.pushNow()}
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
