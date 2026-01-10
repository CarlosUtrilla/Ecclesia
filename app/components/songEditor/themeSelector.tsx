import { cn } from '@/lib/utils'
import React, { useState } from 'react'
import { PresentationView } from '../PresentationView'
import { useQuery } from '@tanstack/react-query'
import { Themes } from '@prisma/client'
import { Input } from '@/ui/input'
type Props = {
  selectedTheme: Themes
  setSelectedTheme: React.Dispatch<React.SetStateAction<Themes>>
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
    <div className="bg-sidebar border-b shadow-sm">
      <div className="px-4 py-2 border-b border-border/40 flex items-center gap-3">
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
          <div
            key={theme.id}
            className={cn(
              'flex-shrink-0 transition-all duration-200',
              selectedTheme?.id === theme.id
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg scale-105'
                : 'opacity-70 hover:opacity-100 hover:scale-102'
            )}
          >
            <PresentationView
              maxHeight={90}
              theme={theme}
              items={[{ text: theme.name }]}
              onClick={() => setSelectedTheme(theme)}
              selected={selectedTheme?.id === theme.id}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
