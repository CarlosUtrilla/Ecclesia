import useBibleSchema from '@/hooks/useBibleSchema'
import useBibleVersions from '@/hooks/useBibleVersions'
import { AutoComplete } from '@/ui/autocomplete'
import { Button } from '@/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog'
import { Input } from '@/ui/input'
import { VirtualizedScrollArea } from '@/ui/virtualized-scroll-area'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { BibleDTO, TextFragmentSearchDTO } from 'database/controllers/bible/bible.dto'
import { Clock, Copy, Play, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import z from 'zod'
type Props = {
  defaultVersion: string
}
export default function TextFragmentSearch({ defaultVersion }: Props) {
  const { bibleSchema } = useBibleSchema()
  const { data: availableBibles = [] } = useBibleVersions()
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors }
  } = useForm({
    defaultValues: {
      text: '',
      book: '',
      version: defaultVersion
    },
    resolver: zodResolver(
      z.object({
        text: z.string().min(1, 'Ingrese una palabra clave'),
        book: z.string().optional(),
        version: z.string().min(1, 'Seleccione una version de la Biblia')
      })
    )
  })

  const values = watch()

  const { data: searchData, mutate } = useMutation({
    mutationKey: ['searchTextFragment'],
    mutationFn: async (params: TextFragmentSearchDTO) => {
      return await window.api.bible.searchTextFragment(params)
    }
  })

  const onSubmit = handleSubmit(async (data) => {
    mutate(data)
  })

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="text-xs">
          <Search className="h-3 w-3" />
          Avanzado
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-5xl w-full">
        <DialogHeader className="border-b pb-3.5">
          <DialogTitle className="flex gap-2 items-center">
            <Search className="w-5 h-5" /> Busqueda avanzada
          </DialogTitle>
        </DialogHeader>
        <div>
          <div className="flex gap-3 items-start">
            <Input
              placeholder="Palabra clave.."
              error={errors.text?.message}
              {...register('text')}
            />
            <AutoComplete
              options={availableBibles.map((b) => ({
                label: b.name,
                value: b.version
              }))}
              placeholder="Versión de la Biblia"
              onValueChange={(value) => setValue('version', value as string)}
              value={values.version}
              emptyMessage="No se encontro esta versión"
              className="w-40"
            />

            <AutoComplete
              options={bibleSchema.map((b) => ({
                label: b.book,
                value: b.book_id
              }))}
              placeholder="Libro"
              onValueChange={(value) => setValue('book', value as string)}
              value={values.book}
              emptyMessage="No se encontro este libro"
              className="w-40"
            />
            <Button onClick={onSubmit}>
              <Search className="w-4 h-4" />
              Buscar
            </Button>
          </div>
          <div>
            {searchData && searchData.length > 0 ? (
              <div>
                <div className="px-2 py-2 text-sm text-muted-foreground">
                  Resultados:{' '}
                  <i>
                    <b>{searchData.length}</b> textos encontrados
                  </i>
                </div>
                <VirtualizedScrollArea
                  className="h-96"
                  items={searchData}
                  renderItem={(item: BibleDTO) => (
                    <ContextMenu>
                      <ContextMenuTrigger>
                        <div className="p-2 border-b select-none hover:bg-muted/40">
                          <div className="font-medium">
                            {item.book} {item.chapter}:{item.verse}
                          </div>
                          <div>{item.text}</div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem>
                          <Play className="text-green-600" /> Presentar
                        </ContextMenuItem>
                        <ContextMenuItem>
                          <Clock /> Añadir al temporario
                        </ContextMenuItem>
                        <ContextMenuItem>
                          <Copy /> Copiar texto
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )}
                  estimateSize={() => 60}
                />
              </div>
            ) : (
              <div className="mt-4">No se encontraron resultados.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
