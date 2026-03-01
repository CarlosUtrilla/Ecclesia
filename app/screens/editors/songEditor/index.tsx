import { Input } from '@/ui/input'
import RichTextEditor from '@/screens/editors/songEditor/richEditor/richTextEditor'
import t from '@locales'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/ui/button'
import { PresentationView } from '../../../ui/PresentationView'
import { useEffect, useMemo, useState } from 'react'
import ThemeSelector from './themeSelector'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams } from 'react-router'
import { CreateSongSchema } from './songsSchemas'
import { CreateSongDTO } from 'database/controllers/songs/songs.dto'
import { Tags } from 'lucide-react'
import { BlockEditor } from './richEditor/utils'
import { ThemeWithMedia } from '../../../ui/PresentationView/types'
import { BlankTheme } from '@/hooks/useThemes'

export default function SongEditor() {
  const { id } = useParams()
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithMedia>(BlankTheme)
  const [editorKeyRender, setEditorKeyRender] = useState(0)

  const {
    control,
    watch,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm({
    defaultValues: {
      title: '',
      copyright: '',
      author: '',
      lyrics: []
    },
    resolver: zodResolver(CreateSongSchema)
  })

  useEffect(() => {
    if (id === undefined) {
      return
    }

    const fetchSong = async () => {
      const song = await window.api.songs.getSongById(Number(id))
      if (song) {
        reset({
          title: song.title,
          author: song.author || '',
          copyright: song.copyright || '',
          lyrics: song.lyrics.reduce((prev, curr) => {
            prev.push({
              content: curr.content,
              tagSongsId: curr.tagSongsId
            })
            // preguntar si la siguiente letra pertenece a una etiqueta diferente para agregar un bloque vacío
            const nextLyric = song.lyrics[song.lyrics.indexOf(curr) + 1]
            if (nextLyric && nextLyric.tagSongsId === curr.tagSongsId) {
              prev.push({
                content: '',
                tagSongsId: curr.tagSongsId
              })
            }

            return prev
          }, [] as BlockEditor[])
        })
        setEditorKeyRender((prev) => prev + 1)
      }
    }
    fetchSong()
  }, [id])

  const values = watch()

  const onSubmit = async (data: CreateSongDTO) => {
    try {
      data.lyrics = data.lyrics.filter((l) => l.content !== '')
      if (id !== undefined) {
        await window.api.songs.updateSong(Number(id), data)
      } else {
        await window.api.songs.createSong(data)
      }
      window.electron.ipcRenderer.send('song-saved')
      window.googleDriveSyncAPI.notifyAutoSaveEvent()
      window.windowAPI.closeCurrentWindow()
    } catch (e) {
      console.error('Error saving song:', e)
      window.alert('Error al guardar la canción. Por favor, inténtalo de nuevo.')
    }
  }

  const cleanesLyrics = useMemo(() => {
    return values.lyrics.filter((l) => l.content !== '')
  }, [values.lyrics])
  return (
    <div className="grid grid-cols-12 h-svh">
      <title>Editor de canciones</title>
      <div className="p-3 gap-2 col-span-4 xl:col-span-3 bg-sidebar border-r flex flex-col overflow-hidden">
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
            <RichTextEditor
              error={errors.lyrics?.message}
              className="flex-1"
              lyrics={field.value}
              onChange={field.onChange}
              key={editorKeyRender}
            />
          )}
        />
      </div>
      <div className="col-span-8 xl:col-span-9 flex overflow-hidden">
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
              className="max-w-xs"
            />
            {cleanesLyrics.map((lyric, index) => (
              <PresentationView
                key={`lyric-${lyric.tagSongsId}-${index}`}
                items={[
                  {
                    text: lyric.content
                  }
                ]}
                theme={selectedTheme!}
                className="max-w-xs"
                tagSongId={lyric.tagSongsId}
              />
            ))}
          </div>
        </div>
        <ThemeSelector selectedTheme={selectedTheme} setSelectedTheme={setSelectedTheme} />
      </div>
    </div>
  )
}
