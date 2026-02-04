import { Button } from '@/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table'
import { Input } from '@/ui/input'
import { ColorPicker } from '@/ui/colorPicker'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, X, Trash2, Keyboard } from 'lucide-react'
import { useState, useEffect } from 'react'
import { TagSongs } from '@prisma/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import useTagSongs from '@/hooks/useTagSongs'

type EditableTag = Omit<TagSongs, 'createdAt' | 'updatedAt'>

// Función para generar abreviación automática desde el nombre
const generateShortName = (name: string): string => {
  const words = name.trim().split(/\s+/)
  const initials = words
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 4)
  return initials || 'TAG'
}

export default function TagSongsEditor() {
  const queryClient = useQueryClient()
  const [editedTags, setEditedTags] = useState<EditableTag[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [capturingShortcut, setCapturingShortcut] = useState<number | null>(null)

  const { tagSongs } = useTagSongs()

  useEffect(() => {
    if (tagSongs.length > 0) {
      setEditedTags(tagSongs)
    }
  }, [tagSongs])

  const updateMutation = useMutation({
    mutationFn: async (tags: EditableTag[]) => {
      // Actualizar cada tag modificado
      for (const tag of tags) {
        if (tag.id > 0) {
          await window.api.tagSongs.updateTagSongs(tag.id, tag)
        } else {
          await window.api.tagSongs.createTagSongs({
            name: tag.name,
            shortName: tag.shortName,
            shortCut: tag.shortCut,
            color: tag.color
          })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tagsSongs'] })
      toast.success('Tags guardadas correctamente')
      setHasChanges(false)
      window.electron.ipcRenderer.send('tags-saved')
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

    // Si se está editando el nombre, actualizar también shortName automáticamente
    if (field === 'name') {
      const limitedValue = value.substring(0, 15) // Limitar a 15 caracteres
      newTags[index] = {
        ...newTags[index],
        name: limitedValue,
        shortName: generateShortName(limitedValue)
      }
    } else {
      newTags[index] = { ...newTags[index], [field]: value }
    }

    setEditedTags(newTags)
    setHasChanges(true)
  }

  const handleShortcutCapture = (index: number, event: React.KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()

    let keyName = event.key

    // Formatear teclas especiales
    if (keyName === ' ') keyName = 'Space'
    if (keyName.length === 1) keyName = keyName.toUpperCase()

    // Ignorar modificadores solos
    if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'Escape'].includes(keyName)) {
      return
    }

    handleFieldChange(index, 'shortCut', keyName)
    setCapturingShortcut(null)
  }

  const handleAddTag = () => {
    const newTag: EditableTag = {
      id: -Date.now(), // ID temporal negativo
      name: 'Nueva Etiqueta',
      shortName: 'NE',
      shortCut: 'C',
      color: '#3b82f6'
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
                <TableHead className="w-[150px] font-semibold">Atajo</TableHead>
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
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setCapturingShortcut(index)}
                      onKeyDown={(e) => handleShortcutCapture(index, e)}
                      onBlur={() => setCapturingShortcut(null)}
                      className={cn(
                        'h-9 w-full rounded-md border px-3 py-1.5',
                        'bg-background text-sm focus:outline-none focus:ring-2',
                        'focus:ring-ring focus:ring-offset-2 font-mono font-semibold',
                        'flex items-center justify-center gap-2 transition-all',
                        capturingShortcut === index && 'ring-2 ring-primary'
                      )}
                      style={{
                        animation:
                          capturingShortcut === index
                            ? 'pulse-fast 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                            : undefined
                      }}
                    >
                      <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
                      {tag.shortCut}
                    </button>
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
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
