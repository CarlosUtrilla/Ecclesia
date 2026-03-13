import { Button } from '@/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table'
import { Input } from '@/ui/input'
import { ColorPicker } from '@/ui/colorPicker'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, X, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { TagSongs } from '@prisma/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import useTagSongs from '@/hooks/useTagSongs'

type EditableTag = Omit<TagSongs, 'createdAt' | 'updatedAt'>

// Genera abreviación única dentro del batch de tags actuales
const generateUniqueShortName = (name: string, existingShortNames: Set<string>): string => {
  const words = name.trim().split(/\s+/)
  const base =
    words
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 4) || 'TAG'
  if (!existingShortNames.has(base)) return base
  for (let i = 1; i <= 99; i++) {
    const candidate = base.substring(0, 3) + i
    if (!existingShortNames.has(candidate)) return candidate
  }
  return base
}

export default function TagSongsEditor() {
  const queryClient = useQueryClient()
  const [editedTags, setEditedTags] = useState<EditableTag[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  const { tagSongs } = useTagSongs()

  useEffect(() => {
    if (tagSongs.length > 0) {
      setEditedTags(tagSongs)
    }
  }, [tagSongs])

  const updateMutation = useMutation({
    mutationFn: async (tags: EditableTag[]) => {
      await window.api.tagSongs.saveManyTagSongs(tags)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tagsSongs'] })
      toast.success('Tags guardadas correctamente')
      setHasChanges(false)
      window.electron.ipcRenderer.send('tags-saved')
      window.googleDriveSyncAPI.notifyAutoSaveEvent()
      window.windowAPI.closeCurrentWindow()
    },
    onError: (error: Error) => {
      toast.error('Error al guardar las tags: ' + error.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await window.api.tagSongs.deleteTagSongs(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tagsSongs'] })
      toast.success('Tag eliminada correctamente')
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar la tag: ' + error.message)
    }
  })

  const handleFieldChange = (index: number, field: keyof EditableTag, value: string) => {
    const newTags = [...editedTags]

    // Si se está editando el nombre, actualizar también shortName automáticamente (único en el batch)
    if (field === 'name') {
      const limitedValue = value.substring(0, 15)
      const otherShortNames = new Set(
        editedTags.filter((_, i) => i !== index).map((t) => t.shortName)
      )
      newTags[index] = {
        ...newTags[index],
        name: limitedValue,
        shortName: generateUniqueShortName(limitedValue, otherShortNames)
      }
    } else {
      newTags[index] = { ...newTags[index], [field]: value }
    }

    setEditedTags(newTags)
    setHasChanges(true)
  }

  const handleAddTag = () => {
    const newTag: EditableTag = {
      id: -Date.now(),
      name: 'Nueva Etiqueta',
      shortName: 'NE',
      shortCut: '',
      color: '#3b82f6',
      deletedAt: null
    }
    setEditedTags([...editedTags, newTag])
    setHasChanges(true)
  }

  const handleDelete = (index: number) => {
    const tag = editedTags[index]
    if (tag.id > 0) {
      deleteMutation.mutate(tag.id)
    }
    const newTags = editedTags.filter((_, i) => i !== index)
    setEditedTags(newTags)
    setHasChanges(true)
  }

  const handleSave = () => {
    updateMutation.mutate(editedTags)
  }

  const handleCancel = () => {
    window.close()
  }

  return (
    <div className="h-screen flex flex-col">
      <title>Etiquetas de canciones</title>
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 border-b shadow-sm flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Etiquetas de Canciones</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organiza tus canciones con etiquetas personalizadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAddTag} variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Añadir
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            size="sm"
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Guardar
          </Button>
          <Button onClick={handleCancel} variant="outline" size="sm" className="gap-2">
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-muted/20">
        <div className="bg-background rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[250px] font-semibold">Nombre</TableHead>
                <TableHead className="w-[100px] font-semibold">Abreviación</TableHead>
                <TableHead className="w-[120px] font-semibold">Color</TableHead>
                <TableHead className="w-[80px] text-center font-semibold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editedTags.map((tag, index) => (
                <TableRow key={tag.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Input
                      value={tag.name}
                      onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                      className="h-9"
                      maxLength={15}
                      placeholder="Nombre de etiqueta"
                      style={{
                        backgroundColor: tag.color + '35',
                        borderColor: tag.color + '40'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        'h-9 rounded-md border px-3 py-1.5',
                        'bg-muted/50 text-center font-mono font-semibold',
                        'flex items-center justify-center text-sm'
                      )}
                      style={{
                        backgroundColor: tag.color + '35',
                        borderColor: tag.color + '60',
                        color: tag.color
                      }}
                    >
                      {tag.shortName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={tag.color}
                        onChange={(color) => handleFieldChange(index, 'color', color)}
                        className="h-9 w-16"
                      />
                      <span className="text-xs text-muted-foreground font-mono">{tag.color}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {editedTags.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No hay etiquetas. Haz clic en &quot;Añadir&quot; para crear una.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
