import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './dialog'
import { Button } from './button'
import { Spinner } from './spinner'

type Phase = 'hidden' | 'confirming' | 'syncing'

export function ClosingDialog() {
  const [phase, setPhase] = useState<Phase>('hidden')

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('app-close-requested', () => {
      setPhase('confirming')
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const handleConfirm = () => {
    setPhase('syncing')
    window.windowAPI.confirmClose()
  }

  const handleCancel = () => {
    setPhase('hidden')
    window.windowAPI.cancelClose()
  }

  const isSyncing = phase === 'syncing'

  return (
    <Dialog
      open={phase !== 'hidden'}
      onOpenChange={(open) => {
        if (!open && phase === 'confirming') handleCancel()
      }}
    >
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (isSyncing) e.preventDefault()
        }}
      >
        {phase === 'confirming' && (
          <>
            <DialogHeader>
              <DialogTitle>¿Cerrar Ecclesia?</DialogTitle>
              <DialogDescription>
                Todas las ventanas abiertas se cerrarán. Los cambios se guardarán antes de salir.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm}>Cerrar aplicación</Button>
            </DialogFooter>
          </>
        )}
        {phase === 'syncing' && (
          <>
            <DialogHeader>
              <DialogTitle>Guardando datos…</DialogTitle>
              <DialogDescription>
                Sincronizando con Google Drive. La aplicación se cerrará automáticamente al
                terminar.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <Spinner size="large" />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
