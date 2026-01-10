import { Input } from '@/ui/input'
import RichTextEditor from '@/components/songEditor/richEditor/richTextEditor'
import t from '@locales'
import { Themes } from '@prisma/client'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/ui/button'
import { PresentationView } from '../PresentationView'
import { useMemo, useState } from 'react'
import ThemeSelector from './themeSelector'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams } from 'react-router'
import { CreateSongSchema } from './songsSchemas'
import { CreateSongDTO } from 'database/controllers/songs/songs.dto'
import { Tags } from 'lucide-react'
import { BlockEditor } from './richEditor/utils'

const BlankTheme: Themes = {
  id: -1,
  name: 'Blank',
  background: '#ffffff',
  backgroundMediaId: null,
  letterSpacing: 0,
  lineHeight: 1.5,
  textSize: 16,
  textColor: '#000000',
  fontFamily: 'Arial',
  previewImage: '',
  textAlign: 'center',
  bold: false,
  italic: false,
  underline: false,
  animationSettings: '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
  createdAt: new Date(),
  updatedAt: new Date()
}

export default function SongEditor() {
  const { id } = useParams()
  const [selectedTheme, setSelectedTheme] = useState<Themes>(BlankTheme)

  const {
    control,
    watch,
    handleSubmit,
    formState: { errors }
  } = useForm({
    defaultValues: {
      title: '',
      copyright: '',
      author: '',
      fullText: '',
      lyrics: []
    },
    resolver: zodResolver(CreateSongSchema)
  })

  const values = watch()

  const onSubmit = async (data: CreateSongDTO) => {
    if (id !== undefined) {
      await window.api.songs.updateSong(Number(id), data)
    } else {
      await window.api.songs.createSong(data)
    }
  }

  const cleanesLyrics = useMemo(() => {
    console.log(values.lyrics)
    return values.lyrics.filter((l) => l.content !== '') as BlockEditor[]
  }, [values.lyrics])

  return (
    <div className="grid grid-cols-12 h-svh">
      <div className="p-3 gap-2 col-span-3 bg-sidebar border-r flex flex-col">
        <div className="flex items-center justify-center mb-2 gap-2">
          <Button onClick={handleSubmit(onSubmit)}>{t('songEditor.save')}</Button>
          <Button onClick={() => window.windowAPI.openTagSongsWindow()}>
            <Tags />
            Editar etiquetas
          </Button>
        </div>
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <Input placeholder={t('songEditor.title')} {...field} error={errors.title?.message} />
          )}
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
          name="lyrics"
          control={control}
          render={({ field }) => (
            <RichTextEditor className="flex-1" lyrics={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      <div className="col-span-9 flex overflow-hidden">
        <div className="p-4 bg-muted/40 flex-1 mx-auto overflow-y-auto">
          <div className="flex flex-wrap h-min gap-2 justify-center">
            <PresentationView
              items={[
                {
                  text: `${values.title || '(Título de la canción)'}
                          <br/>${values.author ? `${values.author}${values.copyright ? ` - ${values.copyright}` : ''}` : ''}`
                }
              ]}
              theme={selectedTheme!}
              maxHeight={180}
            />
            {cleanesLyrics.map((lyric, index) => (
              <PresentationView
                key={index}
                items={[
                  {
                    text: lyric.content
                  }
                ]}
                theme={selectedTheme!}
                maxHeight={180}
                tagSongId={lyric.songsTagsId}
              />
            ))}
          </div>
        </div>
        <ThemeSelector selectedTheme={selectedTheme} setSelectedTheme={setSelectedTheme} />
      </div>
    </div>
  )
}
