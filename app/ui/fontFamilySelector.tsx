import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { useFontsContext } from '@/contexts/fontsContext'
import { Button } from './button'
import UploadFontDialog from './uploadFontDialog'

type FontFamilyProps = {
  onChange: (value: string) => void
  value: string
  className?: string
}

type FontFamily = {
  label: string
  value: string
}

export default function FontFamilySelector({ onChange, value, className }: FontFamilyProps) {
  const [fontFamilies, setFontFamilies] = useState<FontFamily[]>([])
  const { fonts: customFonts } = useFontsContext()
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  useEffect(() => {
    const loadFonts = async () => {
      try {
        const systemFonts = await window.systemAPI.getSystemFonts()
        const formattedFonts = systemFonts.map((font) => ({
          label: font.replace(/['"]/g, ''),
          value: font
        }))
        setFontFamilies(formattedFonts)
      } catch (error) {
        console.error('Error al cargar fuentes del sistema:', error)
      }
    }
    loadFonts()
  }, [])

  return (
    <>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          size="sm"
          className={
            className ?? 'w-[200px] border-primary/40 focus:border-primary bg-background/80'
          }
        >
          <SelectValue placeholder="Seleccionar fuente" />
        </SelectTrigger>
        <SelectContent className="max-h-80 overflow-y-auto rounded-xl shadow-xl border border-primary/20 bg-background/95">
          <Button
            variant="outline"
            size="sm"
            className="w-full my-2 rounded-lg border-primary/30 hover:border-primary text-primary/90 hover:text-primary font-semibold bg-primary/5"
            onClick={(e) => {
              e.preventDefault()
              setUploadDialogOpen(true)
            }}
          >
            + Añadir fuente personalizada
          </Button>
          <div className="my-2 border-t border-primary/10" />
          <div className="px-2 py-1 text-xs text-muted-foreground font-semibold">
            Mis fuentes personalizadas
          </div>
          {customFonts.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground/70 italic">
              No has subido fuentes aún.
            </div>
          )}
          {customFonts.map((font) => (
            <div
              className="relative group flex items-center px-2 py-1 rounded hover:bg-primary/5 transition"
              key={font.fileName}
            >
              <SelectItem value={font.name}>
                <span style={{ fontFamily: font.name }}>{font.name}</span>
              </SelectItem>
              <Button
                variant="destructive"
                size="icon"
                className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5"
                onClick={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (
                    window.confirm(
                      `¿Seguro que quieres borrar la fuente "${font.name}"? Esta acción no se puede deshacer.`
                    )
                  ) {
                    await window.api.fonts.deleteFont({ id: font.id })
                    await window.electron.ipcRenderer.invoke('fonts.deleteFontFile', {
                      fileName: font.fileName
                    })
                  }
                }}
                title="Eliminar fuente"
              >
                ×
              </Button>
            </div>
          ))}
          <div className="my-2 border-t border-primary/10" />
          <div className="px-2 py-1 text-xs text-muted-foreground font-semibold">
            Fuentes del sistema
          </div>
          {fontFamilies.map((font) => (
            <SelectItem key={font.value} value={font.value}>
              <span style={{ fontFamily: font.value }}>{font.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <UploadFontDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} />
    </>
  )
}
