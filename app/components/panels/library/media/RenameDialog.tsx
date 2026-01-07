import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

interface RenameDialogProps {
  open: boolean
  name: string
  onOpenChange: (open: boolean) => void
  onNameChange: (name: string) => void
  onRename: () => void
}

export function RenameDialog({
  open,
  name,
  onOpenChange,
  onNameChange,
  onRename
}: RenameDialogProps) {
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
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Nuevo nombre"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRename()
                if (e.key === 'Escape') onOpenChange(false)
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onRename} disabled={!name.trim()}>
            Renombrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
