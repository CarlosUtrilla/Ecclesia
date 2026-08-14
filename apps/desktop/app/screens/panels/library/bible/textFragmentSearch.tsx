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
import { Clock, Copy, Play, Search } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import z from 'zod'
import { Api } from '@ecclesia/queries'
import { cn } from '@/lib/utils'
import {
  countBibleSearchBooks,
  findBookHeaderForIndex,
  groupBibleSearchResultsByBook,
  type BibleSearchRow
} from './groupSearchResultsByBook'

type BookHeaderProps = {
  book: string
  count: number
  className?: string
}

function BookHeader({ book, count, className }: BookHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2 border-b bg-muted px-2 py-1.5', className)}>
      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
      <span className="text-xs font-semibold uppercase tracking-wider">{book}</span>
      <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
        {count} {count === 1 ? 'coincidencia' : 'coincidencias'}
      </span>
    </div>
  )
}
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
        text: z.string().min(1, 'El texto es requerido'),
        // Sin libro se busca en toda la Biblia; el backend lo trata como opcional.
        book: z.string(),
        version: z.string().min(1, 'La versión es requerida')
      })
    )
  })

  const values = watch()

  const { data: searchData, mutate, submittedAt } = useMutation(Api.mutation.bible.searchTextFragment)

  const resultRows = useMemo(() => groupBibleSearchResultsByBook(searchData ?? []), [searchData])
  const booksCount = useMemo(() => countBibleSearchBooks(resultRows), [resultRows])

  const onSubmit = handleSubmit(async (data) => {
    mutate({ body: data })
  })

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="text-xs col-span-4 flex-1">
          <Search className="h-3 w-3" />
          Busqueda avanzada
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
              onValueChange={(value) => setValue('version', String(value))}
              value={values.version}
              emptyMessage="No se encontro esta versión"
              className="w-40"
            />

            <AutoComplete
              options={bibleSchema.map((b) => ({
                label: b.book,
                // String: el form guarda `book` como texto y AutoComplete compara con ===,
                // con el número el libro elegido no se marcaba como seleccionado.
                value: String(b.book_id)
              }))}
              placeholder="Todos los libros"
              onValueChange={(value) => setValue('book', String(value))}
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
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  <b className="text-foreground tabular-nums">{searchData.length}</b> textos en{' '}
                  <b className="text-foreground tabular-nums">{booksCount}</b>{' '}
                  {booksCount === 1 ? 'libro' : 'libros'}
                </div>
                {/* El borde redondeado va en un wrapper con overflow-hidden: sobre el propio
                    contenedor de scroll dejaba ver una franja del fondo encima de la cabecera fija. */}
                <div className="overflow-hidden rounded-md border">
                  <VirtualizedScrollArea
                    // Remonta en cada búsqueda para volver arriba y reiniciar la cabecera fija.
                    key={submittedAt}
                    className="h-96"
                    items={resultRows}
                    renderStickyHeader={(firstVisibleIndex) => {
                      const header = findBookHeaderForIndex(resultRows, firstVisibleIndex)
                      if (!header) return null
                      return <BookHeader book={header.book} count={header.count} />
                    }}
                    renderItem={(row: BibleSearchRow, index) =>
                      row.kind === 'book' ? (
                        <BookHeader
                          book={row.book}
                          count={row.count}
                          className={cn(index > 0 && 'border-t')}
                        />
                      ) : (
                        <ContextMenu>
                          <ContextMenuTrigger>
                            {/* pl-[11px] alinea la guía vertical justo bajo el punto del libro */}
                            <div className="pl-[11px]">
                              <div className="flex select-none gap-2 border-l py-1.5 pl-3 pr-2 hover:bg-muted/40">
                                <span className="w-11 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                                  {row.verse.chapter}:{row.verse.verse}
                                </span>
                                <span className="text-sm leading-snug">{row.verse.text}</span>
                              </div>
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
                      )
                    }
                    estimateSize={(index) => (resultRows[index]?.kind === 'book' ? 30 : 52)}
                  />
                </div>
              </div>
            ) : searchData ? (
              <div className="mt-4 text-sm text-muted-foreground">
                No se encontraron resultados.
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
