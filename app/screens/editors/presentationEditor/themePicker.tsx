import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { BlankTheme } from '@/hooks/useThemes'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/dialog'
import { Input } from '@/ui/input'
import { PresentationView } from '@/ui/PresentationView'
import { ThemeWithMedia } from '@/ui/PresentationView/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  themes: ThemeWithMedia[]
  selectedThemeId: number | null
  onSelect: (themeId: number | null) => void
}

const previewItems = [
  {
    id: 'theme-preview',
    text: 'Vista previa del tema',
    resourceType: 'TEXT' as const
  }
]

export default function ThemePicker({
  open,
  onOpenChange,
  themes,
  selectedThemeId,
  onSelect
}: Props) {
  const [search, setSearch] = useState('')

  const filteredThemes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return themes

    return themes.filter((theme) => theme.name.toLowerCase().includes(normalizedSearch))
  }, [search, themes])

  const handleSelect = (themeId: number | null) => {
    onSelect(themeId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Seleccionar tema global</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tema"
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`rounded-md border p-2 text-left transition-colors hover:border-primary/80 ${
                selectedThemeId === null ? 'border-primary' : 'border-border'
              }`}
            >
              <PresentationView items={previewItems} theme={BlankTheme} className="w-full" />
              <div className="mt-2 text-sm font-medium">Sin tema</div>
              <div className="text-xs text-muted-foreground">Usa fondo blanco y texto base</div>
            </button>

            {filteredThemes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelect(theme.id)}
                className={`rounded-md border p-2 text-left transition-colors hover:border-primary/80 ${
                  selectedThemeId === theme.id ? 'border-primary' : 'border-border'
                }`}
              >
                <PresentationView items={previewItems} theme={theme} className="w-full" />
                <div className="mt-2 text-sm font-medium truncate">{theme.name}</div>
              </button>
            ))}
          </div>

          {filteredThemes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron temas.
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
