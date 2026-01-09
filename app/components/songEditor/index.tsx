import { Input } from '@/ui/input'
import RichTextEditor from '@/ui/richTextEditor'
import t from '@locales'
import { Song, Themes } from '@prisma/client'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/ui/button'
import { useQuery } from '@tanstack/react-query'
import { PresentationView } from '../PresentationView'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Spinner } from '@/ui/spinner'
export default function SongEditor() {
  const [selectedTheme, setSelectedTheme] = useState<Themes | undefined>(undefined)
  const { data: themes = [] } = useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const themes = await window.api.themes.getAllThemes()
      setSelectedTheme(themes[0])
      return themes
    }
  })
  const { control, watch, handleSubmit } = useForm<Song>({
    defaultValues: {
      title: '',
      author: '',
      copyright: '',
      fullText: '',
      id: -1,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  })

  const values = watch()

  const onSubmit = (data: Song) => {
    console.log(data)
  }

  const separateFullTextOnLyrics = (fullText: string) => {
    // Tiptap genera párrafos con <p> tags
    // Un doble salto de línea se representa como dos <p> consecutivos o un <p> vacío
    // Dividimos por párrafos vacíos o dobles saltos de línea

    // Primero, dividir por párrafos
    const paragraphs = fullText.split(/<\/p>\s*<p>/).map((p) => {
      // Limpiar tags de apertura/cierre del inicio y final
      return p
        .replace(/^<p>/, '')
        .replace(/<\/p>$/, '')
        .trim()
    })

    // Agrupar párrafos separados por párrafos vacíos (doble enter)
    const sections: string[] = []
    let currentSection: string[] = []

    paragraphs.forEach((paragraph) => {
      if (paragraph === '' || paragraph === '<br>' || paragraph === '&nbsp;') {
        // Párrafo vacío = doble enter = nueva sección
        if (currentSection.length > 0) {
          sections.push(`<p>${currentSection.join('</p><p>')}</p>`)
          currentSection = []
        }
      } else {
        currentSection.push(paragraph)
      }
    })

    // Agregar la última sección si existe
    if (currentSection.length > 0) {
      sections.push(`<p>${currentSection.join('</p><p>')}</p>`)
    }

    return sections
  }
  return (
    <div className="grid grid-cols-12 h-svh">
      <div className="p-3 gap-2 col-span-4 bg-sidebar border-r flex flex-col">
        <div className="flex items-center justify-center mb-2">
          <Button onClick={handleSubmit(onSubmit)}>{t('songEditor.save')}</Button>
        </div>
        <Controller
          name="title"
          control={control}
          render={({ field }) => <Input placeholder={t('songEditor.title')} {...field} />}
        />
        <Controller
          name="author"
          control={control}
          render={({ field }) => (
            <Input placeholder={t('songEditor.author')} {...field} value={field.value || ''} />
          )}
        />
        <Controller
          name="copyright"
          control={control}
          render={({ field }) => (
            <Input placeholder={t('songEditor.copyright')} {...field} value={field.value || ''} />
          )}
        />
        <Controller
          name="fullText"
          control={control}
          render={({ field }) => (
            <RichTextEditor
              className="flex-1"
              text={field.value || ''}
              onTextChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="col-span-8 flex flex-col">
        <div
          className={cn(
            'bg-muted p-4 overflow-x-auto flex items-center justify-center',
            'w-full border-b gap-1'
          )}
        >
          {themes.map((theme) => (
            <PresentationView
              maxHeight={90}
              key={theme.id}
              theme={theme}
              items={[{ text: theme.name }]}
              onClick={() => setSelectedTheme(theme)}
              selected={selectedTheme?.id === theme.id}
            />
          ))}
        </div>
        {selectedTheme ? (
          <div className="flex flex-wrap flex-1 gap-2 p-4 bg-muted/40 items-start justify-center col-span-9">
            <PresentationView
              items={[
                {
                  text: `${values.title || '(Título de la canción)'}
                        <br/>${values.author ? `${values.author}${values.copyright ? ` - ${values.copyright}` : ''}` : ''}`
                }
              ]}
              theme={selectedTheme!}
            />
            {separateFullTextOnLyrics(values.fullText || '').map((section, index) => (
              <PresentationView
                key={index}
                items={[
                  {
                    text: section
                  }
                ]}
                theme={selectedTheme!}
              />
            ))}
          </div>
        ) : (
          <Spinner />
        )}
      </div>
    </div>
  )
}
