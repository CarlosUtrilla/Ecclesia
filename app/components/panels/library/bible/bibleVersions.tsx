import useBibleVersions from '@/hooks/useBibleVersions'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger
} from '@/ui/combobox'

type Props = {
  selectedVersion: string
  setSelectedVersion: (version: string) => void
}

export default function BibleVersions({ selectedVersion, setSelectedVersion }: Props) {
  const { data: availableBibles = [] } = useBibleVersions()
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
  return (
    <div>
      <Combobox
        data={availableBibles.map((b) => ({
          label: `${b.name}`,
          value: b.version
        }))}
        value={selectedVersion}
        onValueChange={(newValue) => setSelectedVersion(newValue)}
        type="una biblia"
      >
        <ComboboxTrigger className="w-full" />
        <ComboboxContent>
          <ComboboxInput />
          <ComboboxEmpty />
          <ComboboxList>
            {Object.entries(groupedBibles).map(([language, bibles]) => (
              <ComboboxGroup key={language} className="capitalize" heading={language}>
                {bibles.map((bible) => (
                  <ComboboxItem key={bible.version} value={bible.version}>
                    {bible.name}
                  </ComboboxItem>
                ))}
              </ComboboxGroup>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
