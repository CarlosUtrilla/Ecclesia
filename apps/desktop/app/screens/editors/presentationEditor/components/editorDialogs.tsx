import { Save } from 'lucide-react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/ui/dialog'
import { MediaPicker } from '@/screens/panels/library/media/exports'
import BibleTextPicker, { type BibleTextSelection } from '../bibleTextPicker'
import ThemePicker from '../themePicker'
import type { Media } from '@ecclesia/api'
import type { ThemeWithMedia } from '@/ui/PresentationView/types'

type Props = {
  saveDialogOpen: boolean
  onSaveDialogOpenChange: (open: boolean) => void
  saveName: string
  onSaveNameChange: (name: string) => void
  onSave: () => void
  isSubmitting: boolean
  showCloseDialog: boolean
  onCloseDiscard: () => void
  onCloseCancel: () => void
  onCloseSave: () => void
  renameSlideDialogOpen: boolean
  onRenameSlideDialogOpenChange: (open: boolean) => void
  renameSlideName: string
  onRenameSlideNameChange: (name: string) => void
  onRenameSlide: () => void
  renameSlidePlaceholder: string
  isMediaPickerOpen: boolean
  onMediaPickerOpenChange: (open: boolean) => void
  onMediaPickerSelect: (media: Media) => void
  isBiblePickerOpen: boolean
  onBiblePickerOpenChange: (open: boolean) => void
  onBiblePickerAdd: (selection: BibleTextSelection) => void
  isThemePickerOpen: boolean
  onThemePickerOpenChange: (open: boolean) => void
  themes: ThemeWithMedia[]
  globalThemeId: number | null
  onThemePickerSelect: (themeId: number | null) => void
}

export default function EditorDialogs({
  saveDialogOpen,
  onSaveDialogOpenChange,
  saveName,
  onSaveNameChange,
  onSave,
  isSubmitting,
  showCloseDialog,
  onCloseDiscard,
  onCloseCancel,
  onCloseSave,
  renameSlideDialogOpen,
  onRenameSlideDialogOpenChange,
  renameSlideName,
  onRenameSlideNameChange,
  onRenameSlide,
  renameSlidePlaceholder,
  isMediaPickerOpen,
  onMediaPickerOpenChange,
  onMediaPickerSelect,
  isBiblePickerOpen,
  onBiblePickerOpenChange,
  onBiblePickerAdd,
  isThemePickerOpen,
  onThemePickerOpenChange,
  themes,
  globalThemeId,
  onThemePickerSelect
}: Props) {
  return (
    <>
      <Dialog open={saveDialogOpen} onOpenChange={onSaveDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar presentación</DialogTitle>
            <DialogDescription>Escribe un nombre para la presentación.</DialogDescription>
          </DialogHeader>
          <Input
            value={saveName}
            onChange={(e) => onSaveNameChange(e.target.value)}
            placeholder="Nombre de la presentación"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSave()
                onSaveDialogOpenChange(false)
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => onSaveDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={isSubmitting} onClick={onSave}>
              <Save className="size-4 mr-1.5" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCloseDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onCloseCancel()
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Cambios sin guardar</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar en esta presentación. ¿Qué deseas hacer?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={onCloseCancel}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onCloseDiscard}>
              Salir sin guardar
            </Button>
            <Button onClick={onCloseSave} disabled={isSubmitting}>
              <Save className="size-4" />
              Guardar y salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameSlideDialogOpen} onOpenChange={onRenameSlideDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar diapositiva</DialogTitle>
            <DialogDescription>
              Escribe un nombre para identificar esta diapositiva en el carrusel.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameSlideName}
            onChange={(event) => onRenameSlideNameChange(event.target.value)}
            placeholder={renameSlidePlaceholder}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onRenameSlide()
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => onRenameSlideDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={onRenameSlide}>Guardar nombre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPicker
        open={isMediaPickerOpen}
        onOpenChange={onMediaPickerOpenChange}
        onSelect={onMediaPickerSelect}
        title="Seleccionar imagen o video"
      />

      <BibleTextPicker
        open={isBiblePickerOpen}
        onOpenChange={onBiblePickerOpenChange}
        onAddToPresentation={onBiblePickerAdd}
      />

      <ThemePicker
        open={isThemePickerOpen}
        onOpenChange={onThemePickerOpenChange}
        themes={themes}
        selectedThemeId={globalThemeId}
        onSelect={onThemePickerSelect}
      />
    </>
  )
}
