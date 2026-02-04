import { cn } from '@/lib/utils'
import React, { useState } from 'react'
import { PresentationView } from '../../../ui/PresentationView'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/ui/input'
import { ThemeWithMedia } from '../../../ui/PresentationView/types'
type Props = {
  selectedTheme: ThemeWithMedia
  setSelectedTheme: React.Dispatch<React.SetStateAction<ThemeWithMedia>>
}

export default function ThemeSelector({ selectedTheme, setSelectedTheme }: Props) {
  const [nameFilter, setNameFilter] = useState('')
  const { data: themes = [] } = useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const themes = await window.api.themes.getAllThemes()
      if (themes.length > 0 && selectedTheme.name === 'Blank') {
        setSelectedTheme(themes[0])
      }
      return themes
    }
  })
  const filteredThemes = themes.filter((theme) =>
    theme.name.toLowerCase().includes(nameFilter.toLowerCase())
  )

  return (
    <div className="bg-sidebar border-b shadow-sm max-w-52">
      <div className="px-4 py-2 border-b border-border/40">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-1">
            <h3 className="text-xs font-semibold tracking-tight text-foreground/90">Temas</h3>
          </div>
          <Input
            placeholder="Buscar tema..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="h-7 border-input text-xs max-w-[200px]"
          />
        </div>
        <div className="text-xs text-muted-foreground mt-2 break-words">
          Seleccione un tema para previsualizar su canción
        </div>
      </div>
      <div
        className={cn(
          'p-3 overflow-x-auto flex items-center flex-col gap-2',
          'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent'
        )}
      >
        {filteredThemes.length === 0 && (
          <div className="text-sm text-muted-foreground mt-4">No se encontraron temas.</div>
        )}
        {filteredThemes.map((theme) => (
          <PresentationView
            className="max-w-48"
            theme={theme}
            items={[{ text: theme.name }]}
            onClick={() => setSelectedTheme(theme)}
            selected={selectedTheme?.id === theme.id}
            key={theme.id}
          />
        ))}
      </div>
    </div>
  )
}
