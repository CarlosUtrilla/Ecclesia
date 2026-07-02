import { Save, Undo2, Redo2, Palette } from 'lucide-react'
import { Button } from '@/ui/button'
import { ColorPicker } from '@/ui/colorPicker'
import type { ThemeWithMedia } from '@/ui/PresentationView/types'

type Props = {
  title: string | undefined
  onOpenSaveDialog: () => void
  onUndo: () => void
  onRedo: () => void
  selectedSlide: { backgroundColor?: string } | undefined
  onSlideBackgroundChange: (color: string) => void
  onResetSlideBackground: () => void
  globalThemeId: number | null
  themes: ThemeWithMedia[]
  onOpenThemePicker: () => void
}

export default function EditorTopBar({
  title,
  onOpenSaveDialog,
  onUndo,
  onRedo,
  selectedSlide,
  onSlideBackgroundChange,
  onResetSlideBackground,
  globalThemeId,
  themes,
  onOpenThemePicker
}: Props) {
  return (
    <div className="h-10 px-3 flex items-center gap-1 border-b bg-background shrink-0">
      <button
        type="button"
        onClick={onOpenSaveDialog}
        className="flex items-center gap-1.5 px-2 h-7 rounded hover:bg-muted transition-colors max-w-[200px] shrink-0"
        title="Haz clic para guardar o renombrar"
      >
        <Save className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{title || 'Sin título'}</span>
      </button>

      <div className="w-px h-5 bg-border mx-1 shrink-0" />

      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={onUndo}
        title="Deshacer (Ctrl+Z)"
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={onRedo}
        title="Rehacer (Ctrl+Y)"
      >
        <Redo2 className="size-4" />
      </Button>

      <div className="flex-1" />

      {selectedSlide ? (
        <>
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1 shrink-0">
            <span className="text-[11px] text-muted-foreground leading-none">
              Fondo diapositiva
            </span>
            <ColorPicker
              value={selectedSlide.backgroundColor || '#ffffff'}
              onChange={onSlideBackgroundChange}
              className="h-6 w-7 shrink-0"
            />
            {selectedSlide.backgroundColor ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={onResetSlideBackground}
              >
                Restablecer
              </Button>
            ) : (
              <span className="text-[11px] text-muted-foreground leading-none">Usa tema</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs shrink-0"
            onClick={onOpenThemePicker}
          >
            <Palette className="size-3.5" />
            {globalThemeId === null
              ? 'Sin tema'
              : (themes.find((t) => t.id === globalThemeId)?.name ?? 'Tema')}
          </Button>
        </>
      ) : null}
    </div>
  )
}
