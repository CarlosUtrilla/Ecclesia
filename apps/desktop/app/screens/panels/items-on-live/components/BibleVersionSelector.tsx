import { useCallback, useMemo, useState } from 'react'
import useBibleVersions from '@/hooks/useBibleVersions'
import { AutoComplete, Option } from '@/ui/autocomplete'
import { Tooltip } from '@/ui/tooltip'
import { BookOpen, Check } from 'lucide-react'

type Props = {
  value: string
  onValueChange: (newVersion: number | string) => void
  isLoading?: boolean
  className?: string
  previewSource?: {
    bookId: number
    chapter: number
    verses?: number[]
    verseStart: number
    verseEnd?: number
  } | null
}

const PREVIEW_MAX_CHARS = 150

const trimPreviewText = (text: string) => {
  const compactText = text.replace(/\s+/g, ' ').trim()
  if (compactText.length <= PREVIEW_MAX_CHARS) {
    return compactText
  }

  return `${compactText.slice(0, PREVIEW_MAX_CHARS).trimEnd()}...`
}

export default function BibleVersionSelector({
  value,
  onValueChange,
  isLoading = false,
  className = '',
  previewSource = null
}: Props) {
  const { data: versions, isLoading: versionsLoading } = useBibleVersions()
  const [previewByVersion, setPreviewByVersion] = useState<Record<string, string>>({})
  const [loadingVersionSet, setLoadingVersionSet] = useState<Record<string, boolean>>({})

  const options: Option[] = (versions || []).map((version) => ({
    value: version.version,
    label: version.name ? `${version.version} - ${version.name}` : version.version
  }))

  const loadPreviewForVersion = useCallback(
    async (version: string) => {
      if (!previewSource || previewByVersion[version] || loadingVersionSet[version]) {
        return
      }

      setLoadingVersionSet((previous) => ({ ...previous, [version]: true }))

      try {
        const verses =
          previewSource.verses && previewSource.verses.length > 0
            ? previewSource.verses
            : Array.from(
                {
                  length: (previewSource.verseEnd ?? previewSource.verseStart) -
                    previewSource.verseStart +
                    1
                },
                (_, index) => previewSource.verseStart + index
              )

        const result = await window.api.bible.getVerses({
          book: previewSource.bookId,
          chapter: previewSource.chapter,
          verses,
          version
        })

        const previewText = trimPreviewText(
          result.map((verse) => `${verse.verse}. ${verse.text}`).join(' ')
        )

        setPreviewByVersion((previous) => ({
          ...previous,
          [version]: previewText || 'Sin vista previa disponible'
        }))
      } catch {
        setPreviewByVersion((previous) => ({
          ...previous,
          [version]: 'No se pudo cargar la vista previa'
        }))
      } finally {
        setLoadingVersionSet((previous) => ({ ...previous, [version]: false }))
      }
    },
    [loadingVersionSet, previewByVersion, previewSource]
  )

  const renderVersionOption = useCallback(
    (option: Option, isSelected: boolean) => {
      const version = String(option.value)

      if (!previewSource) {
        return (
          <>
            {option.label}
            {isSelected ? <Check className="w-4 ml-auto" /> : null}
          </>
        )
      }

      const previewText = loadingVersionSet[version]
        ? 'Cargando vista previa...'
        : previewByVersion[version] || 'Pasa el cursor para cargar vista previa'

      return (
        <Tooltip
          content={previewText}
          contentProps={{ side: 'right', align: 'start', sideOffset: 8, className: 'max-w-xs' }}
        >
          <div
            className="flex w-full items-center gap-2"
            onMouseEnter={() => {
              loadPreviewForVersion(version)
            }}
          >
            {option.label}
            {isSelected ? <Check className="w-4 ml-auto" /> : null}
          </div>
        </Tooltip>
      )
    },
    [loadPreviewForVersion, loadingVersionSet, previewByVersion, previewSource]
  )

  const shouldRenderPreviewTooltip = useMemo(() => Boolean(previewSource), [previewSource])

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`.trim()}>
      <BookOpen className="size-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">Versión</span>
      <div className="min-w-0">
        <AutoComplete
          options={options}
          value={value}
          onValueChange={onValueChange}
          emptyMessage="Versión no encontrada"
          placeholder="Buscar versión..."
          isLoading={versionsLoading || isLoading}
          className="w-72 max-w-full"
          contentPlacement="top"
          showAllOnFocus
          renderOption={shouldRenderPreviewTooltip ? renderVersionOption : undefined}
        />
      </div>
    </div>
  )
}
