import ThemesPanel from './components/themes'

export default function PreviewPanel() {
  return (
    <div className="flex flex-col border-r">
      <div className="flex-1">preview</div>
      <ThemesPanel />
    </div>
  )
}
