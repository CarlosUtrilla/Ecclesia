import { Button } from '@/ui/button'
import ThemesPanel from './components/themes'

export default function PreviewPanel() {
  return (
    <div className="flex flex-col border-r">
      <div className="flex-1">
        <Button
          onClick={async () => {
            const schema = await window.api.bible.getBibleSchema()
            console.log(schema)
          }}
        >
          Probar biblia
        </Button>
      </div>
      <ThemesPanel />
    </div>
  )
}
