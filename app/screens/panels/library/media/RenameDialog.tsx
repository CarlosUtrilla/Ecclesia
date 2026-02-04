import { useEffect, useState } from 'react'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

interface RenameDialogProps {
  open: boolean
  initialName: string
  onOpenChange: (open: boolean) => void
  onRename: (newName: string) => void
}

export function RenameDialog({ open, initialName, onOpenChange, onRename }: RenameDialogProps) {
  const [name, setName] = useState('')

  // Inicializar el nombre cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      setName(initialName)
    }
  }, [open, initialName])

  const handleRename = () => {
    if (!name.trim()) return
    onRename(name.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rename">Nuevo nombre</Label>
            <Input
              id="rename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nuevo nombre"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleRename()
                }
                if (e.key === 'Escape') onOpenChange(false)
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleRename} disabled={!name.trim()}>
            Renombrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
