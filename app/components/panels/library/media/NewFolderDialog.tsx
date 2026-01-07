import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

interface NewFolderDialogProps {
  open: boolean
  folderName: string
  onOpenChange: (open: boolean) => void
  onFolderNameChange: (name: string) => void
  onCreate: () => void
}

export function NewFolderDialog({
  open,
  folderName,
  onOpenChange,
  onFolderNameChange,
  onCreate
}: NewFolderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva carpeta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Nombre de la carpeta</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => onFolderNameChange(e.target.value)}
              placeholder="Mi carpeta"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCreate()
                if (e.key === 'Escape') onOpenChange(false)
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onCreate} disabled={!folderName.trim()}>
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
