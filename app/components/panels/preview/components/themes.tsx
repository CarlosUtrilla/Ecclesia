import { PresentationView, PresentationViewProvider } from '@/components/PresentationView'
import { Button } from '@/ui/button'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

export default function ThemesPanel() {
  const { data = [] } = useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      return window.api.themes.getAllThemes()
    }
  })
  return (
    <div className="flex-1 border-t">
      <div className="bg-muted/40 px-3 py-1 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">Themes</h2>
        <div>
          <Button
            size="sm"
            className="text-xs h-7"
            onClick={() => window.windowAPI.openThemeWindow()}
          >
            <Plus /> Add Theme
          </Button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap overflow-y-auto p-3 max-h-max">
        {/*  <PresentationViewProvider maxHeight={120}>
          {data.map((theme) => (
            <PresentationView key={theme.id} text="" />
          ))}
        </PresentationViewProvider> */}
      </div>
    </div>
  )
}
