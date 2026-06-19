import { useEffect, useMemo, useState } from 'react'
import { AutoComplete, Option, OptionGroup } from './autocomplete'
import { useFontsContext } from '@/contexts/fontsContext'
import { Button } from './button'
import UploadFontDialog from './uploadFontDialog'
import { Check, Plus } from 'lucide-react'
import {
  buildGroupedCustomFontOptions,
  resolveSelectedCustomFontValue
} from './fontFamilySelector.utils'
import { Api } from '@ecclesia/queries'

type FontFamilyProps = {
  onChange: (value: string) => void
  value: string
  className?: string
}

export default function FontFamilySelector({ onChange, value }: FontFamilyProps) {
  const [systemFontOptions, setSystemFontOptions] = useState<Option[]>([])
  const { fonts: customFonts } = useFontsContext()
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  useEffect(() => {
    Api.fetch.fonts
      .getSystemFonts()
      .then((fonts: string[]) =>
        setSystemFontOptions(
          fonts.map((font) => ({ value: font, label: font.replace(/['"]/g, '') }))
        )
      )
      .catch((error) => console.error('Error al cargar fuentes del sistema:', error))
  }, [])

  const groupedCustomFontOptions = useMemo(
    () => buildGroupedCustomFontOptions(customFonts),
    [customFonts]
  )

  const customFontNames = useMemo(
    () => new Set(groupedCustomFontOptions.map((f) => f.value)),
    [groupedCustomFontOptions]
  )

  const customFontByFamily = useMemo(
    () => new Map(groupedCustomFontOptions.map((f) => [f.value, f] as const)),
    [groupedCustomFontOptions]
  )

  const selectedValue = useMemo(
    () => resolveSelectedCustomFontValue(value, groupedCustomFontOptions),
    [value, groupedCustomFontOptions]
  )

  const groups: OptionGroup[] = useMemo(
    () => [
      {
        label: 'Mis fuentes personalizadas',
        options: groupedCustomFontOptions.map((f) => ({ value: f.value, label: f.label }))
      },
      {
        label: 'Fuentes del sistema',
        options: systemFontOptions
      }
    ],
    [groupedCustomFontOptions, systemFontOptions]
  )

  const handleDeleteFont = async (e: React.MouseEvent, familyName: string) => {
    e.preventDefault()
    e.stopPropagation()

    const grouped = customFontByFamily.get(familyName)
    if (!grouped) return

    const variantsText =
      grouped.variantCount > 1
        ? `\n\nSe eliminarán ${grouped.variantCount} variantes de esta familia.`
        : ''

    if (
      window.confirm(
        `¿Seguro que quieres borrar la fuente "${grouped.label}"? Esta acción no se puede deshacer.${variantsText}`
      )
    ) {
      for (const fontId of grouped.fontIds) {
        await Api.fetch.fonts.deleteFont({ body: { id: fontId } })
      }
    }
  }

  const addFontButton = (
    <div className="p-1 border-b">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-primary gap-2 rounded-sm"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={() => setUploadDialogOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Añadir nuevas fuentes
      </Button>
    </div>
  )

  return (
    <>
      <AutoComplete
        groups={groups}
        beforeOptions={addFontButton}
        showAllOnFocus
        value={selectedValue}
        onValueChange={(v) => {
          if (v) onChange(String(v))
        }}
        emptyMessage="Fuente no encontrada"
        placeholder="Buscar fuente..."
        className="w-[190px]"
        renderOption={(option, isSelected) => {
          const isCustom = customFontNames.has(String(option.value))
          return (
            <div className="flex items-center w-full gap-2 min-w-0">
              <span style={{ fontFamily: String(option.value) }} className="flex-1 truncate">
                {option.label}
              </span>
              {isSelected && <Check className="w-4 shrink-0" />}
              {isCustom && (
                <button
                  className="ml-1 h-4 w-4 shrink-0 flex items-center justify-center rounded text-destructive hover:bg-destructive/10 text-xs leading-none opacity-60 hover:opacity-100"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => handleDeleteFont(e, String(option.value))}
                  title="Eliminar fuente"
                >
                  ×
                </button>
              )}
            </div>
          )
        }}
      />
      <UploadFontDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} />
    </>
  )
}
