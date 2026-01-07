import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

type FontFamilyProps = {
  onChange: (value: string) => void
  value: string
}

type FontFamily = {
  label: string
  value: string
}

export default function FontFamilySelector({ onChange, value }: FontFamilyProps) {
  const [fontFamilies, setFontFamilies] = useState<FontFamily[]>([])

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
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-[180px]">
        <SelectValue placeholder="Seleccionar fuente" />
      </SelectTrigger>
      <SelectContent>
        {fontFamilies.map((font) => (
          <SelectItem key={font.value} value={font.value}>
            <span style={{ fontFamily: font.value }}>{font.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
