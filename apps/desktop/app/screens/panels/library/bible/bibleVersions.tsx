import useBibleVersions from '@/hooks/useBibleVersions'
import { ScrollArea } from '@/ui/scroll-area'
import { Input } from '@/ui/input'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

type Props = {
  selectedVersion: string
  setSelectedVersion: (version: string) => void
}

export default function BibleVersions({ selectedVersion, setSelectedVersion }: Props) {
  const { data: availableBibles = [] } = useBibleVersions()
  const [searchQuery, setSearchQuery] = useState('')

  const groupedBibles = availableBibles.reduce(
    (groups: Record<string, typeof availableBibles>, bible) => {
      const language = bible.language || 'Unknown'
      if (!groups[language]) {
        groups[language] = []
      }
      groups[language].push(bible)
      return groups
    },
    {}
  )

  // Filtrar biblias basado en búsqueda
  const filteredGroupedBibles = Object.entries(groupedBibles).reduce(
    (filtered, [language, bibles]) => {
      const filteredBibles = bibles.filter(
        (bible) =>
          bible.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          bible.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
          language.toLowerCase().includes(searchQuery.toLowerCase())
      )
      if (filteredBibles.length > 0) {
        filtered[language] = filteredBibles
      }
      return filtered
    },
    {} as Record<string, typeof availableBibles>
  )

  const hasResults = Object.keys(filteredGroupedBibles).length > 0

  return (
    <div className="flex flex-1 w-full flex-col panel-scrollable">
      {/* Búsqueda compacta */}
      <div className="pb-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3" />
          <Input
            placeholder="Buscar versión de biblia..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {/* Lista scrolleable */}
      <ScrollArea className="panel-scroll-content">
        {!hasResults ? (
          <div className="p-4 text-center text-muted-foreground">
            <Search className="w-4 h-4 mx-auto mb-2" />
            <p className="text-xs">Sin resultados</p>
          </div>
        ) : (
          <div className="space-y-1">
            {Object.entries(filteredGroupedBibles).map(([language, bibles]) => (
              <div key={language}>
                {/* Encabezado del idioma */}
                <div className="sticky top-0 bg-background p-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {language}
                </div>

                {/* Lista de biblias */}
                <div>
                  {bibles.map((bible) => (
                    <button
                      key={bible.version}
                      onClick={() => setSelectedVersion(bible.version)}
                      className={cn(
                        'w-full cursor-pointer text-left px-2 py-1.5 hover:bg-accent transition-colors text-xs',
                        {
                          'bg-primary/10 text-primary font-medium':
                            selectedVersion === bible.version
                        }
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{bible.name}</span>
                        {selectedVersion === bible.version && (
                          <Check className="h-3 w-3 text-primary flex-shrink-0 ml-1" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
