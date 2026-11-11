import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog'
import { Textarea } from '@/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
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
import { AI_PROVIDER_LABELS, formatModelLabel, type AIProvider } from '@/lib/aiModels'
import { cn, generateUniqueId } from '@/lib/utils'
import { Api } from '@ecclesia/queries'
import { useSchedule } from '@/contexts/ScheduleContext'
import useBibleSchema from '@/hooks/useBibleSchema'
import { buildBibleAccessData } from '@/screens/panels/library/bible/accessData'
import {
  FileText,
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Plus,
  Settings,
  File,
  FileType2,
  Loader2
} from 'lucide-react'
import type { ExtractedContentDTO, BibleReferenceDTO } from '@ecclesia/api/controllers/ai/ai.dto.d'

interface AIScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type DocKind = 'pdf' | 'word'

const DOC_ACCEPT = '.pdf,.docx,.doc'

function getDocKind(fileName: string): DocKind | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx' || ext === 'doc') return 'word'
  return null
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export default function AIScheduleDialog({ open, onOpenChange }: AIScheduleDialogProps) {
  const [activeTab, setActiveTab] = useState('text')
  const [inputText, setInputText] = useState('')
  const [docFile, setDocFile] = useState<{ path: string; kind: DocKind } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ExtractedContentDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addedRefs, setAddedRefs] = useState<Set<string>>(new Set())
  const [aiConfig, setAiConfig] = useState<{
    hasKey: boolean
    provider?: AIProvider
    model?: string
  } | null>(null)
  const { form } = useSchedule()
  const { bibleSchema } = useBibleSchema()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const findBookByName = useMemo(() => {
    return (bookName: string) => {
      const normalized = normalizeString(bookName)
      return bibleSchema.find((b) => normalizeString(b.book) === normalized) || null
    }
  }, [bibleSchema])

  const loadAiConfig = useCallback(() => {
    Api.fetch.ai
      .getProviderConfig()
      .then((config) => setAiConfig(config))
      .catch(() => setAiConfig({ hasKey: false }))
  }, [])

  // La configuracion se edita en otra ventana: al volver el foco se relee para
  // reflejar la key, el proveedor o el modelo recien guardados.
  useEffect(() => {
    if (!open) return
    loadAiConfig()
    window.addEventListener('focus', loadAiConfig)
    return () => window.removeEventListener('focus', loadAiConfig)
  }, [open, loadAiConfig])

  const isConfigured = aiConfig?.hasKey === true
  const provider = aiConfig?.provider

  // Misma queryKey que la seccion de ajustes: comparten cache de modelos.
  const modelsQuery = useQuery({
    queryKey: ['ai-models', provider],
    queryFn: () => Api.fetch.ai.getAvailableModels({ body: { provider: provider! } }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: open && !!provider && isConfigured
  })

  const modelOptions = useMemo(
    () =>
      (modelsQuery.data?.models ?? []).map((id) => ({ value: id, label: formatModelLabel(id) })),
    [modelsQuery.data]
  )

  const handleModelChange = async (model: string) => {
    if (!model || !provider || model === aiConfig?.model) return
    setAiConfig((prev) => (prev ? { ...prev, model } : prev))
    try {
      await Api.fetch.ai.saveProviderConfig({ body: { provider, model } })
    } catch (err) {
      setError(resolveErrorMessage(err, 'No se pudo cambiar el modelo.'))
      loadAiConfig()
    }
  }

  const resolveErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message
    if (typeof err === 'string' && err) return err
    if (err && typeof err === 'object') {
      const { error, message } = err as { error?: unknown; message?: unknown }
      if (typeof error === 'string' && error) return error
      if (typeof message === 'string' && message) return message
    }
    return fallback
  }

  const handleExtractFromText = async () => {
    if (!inputText.trim()) {
      setError('Por favor, ingresa el texto del sermón o bosquejo.')
      return
    }

    setIsProcessing(true)
    setError(null)
    setResult(null)

    try {
      const extracted = await Api.fetch.ai.extractFromText({ body: { text: inputText } })
      setResult(extracted)
    } catch (err) {
      setError(
        resolveErrorMessage(err, 'Error al extraer referencias. Verifica tu configuración de IA.')
      )
    } finally {
      setIsProcessing(false)
    }
  }

  // Un solo selector para PDF y Word: el tipo se deduce de la extension y
  // decide a que endpoint se envia.
  const selectDocFile = (file: File | undefined) => {
    if (!file) return
    const kind = getDocKind(file.name)
    if (!kind) {
      setDocFile(null)
      setError(`"${file.name}" no es un archivo compatible. Usá un PDF o un Word (.docx, .doc).`)
      return
    }
    const path = window.mediaAPI.getPathForFile(file)
    if (!path) {
      setError(`No se pudo leer la ruta de "${file.name}".`)
      return
    }
    setError(null)
    setResult(null)
    setDocFile({ path, kind })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectDocFile(e.target.files?.[0])
    // Permite volver a elegir el mismo archivo despues de quitarlo.
    e.target.value = ''
  }

  const canDrop = isConfigured && !isProcessing

  const handleDragOver = (e: React.DragEvent) => {
    if (!canDrop || !e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!canDrop) return
    if (e.dataTransfer.files.length > 1) {
      setError('Soltá un solo archivo a la vez.')
      return
    }
    selectDocFile(e.dataTransfer.files[0])
  }

  const handleExtractFromFile = async () => {
    if (!docFile) {
      setError('Por favor, selecciona un archivo PDF o Word.')
      return
    }

    setIsProcessing(true)
    setError(null)
    setResult(null)

    try {
      const extracted =
        docFile.kind === 'pdf'
          ? await Api.fetch.ai.extractFromPdf({ body: { pdfPath: docFile.path } })
          : await Api.fetch.ai.extractFromDocx({ body: { docxPath: docFile.path } })
      setResult(extracted)
    } catch (err) {
      setError(
        resolveErrorMessage(
          err,
          docFile.kind === 'pdf'
            ? 'Error al procesar el PDF. Verifica tu configuración de IA.'
            : 'Error al procesar el documento. Verifica tu configuración de IA.'
        )
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const resolveRef = useCallback(
    (ref: BibleReferenceDTO): { accessData: string; refKey: string } | null => {
      const book = findBookByName(ref.book)
      if (!book) {
        setError(`No se encontró el libro "${ref.book}" en la biblioteca de bíblias`)
        return null
      }
      const bookId = book.book_id || book.id
      if (!bookId) {
        setError(`No se pudo determinar el ID del libro "${ref.book}"`)
        return null
      }
      const verseRange = ref.verseEnd ? `${ref.verseStart}-${ref.verseEnd}` : String(ref.verseStart)
      const accessData = buildBibleAccessData({
        bookId: Number(bookId),
        chapter: ref.chapter,
        verseRange,
        version: 'RVR1960'
      })
      const refKey = `${ref.book}-${ref.chapter}-${ref.verseStart}-${ref.verseEnd || ''}`
      return { accessData, refKey }
    },
    [findBookByName]
  )

  const addItemsToForm = useCallback(
    (items: { type: string; accessData: string }[]) => {
      const currentItems = form.getValues('items') || []
      const newItems = items.map((item, idx) => ({
        id: generateUniqueId(),
        order: currentItems.length + idx + 1,
        type: item.type as any,
        accessData: item.accessData,
        scheduleId: form.getValues('id') || -1,
        updatedAt: new Date(),
        deletedAt: null
      }))
      const allItems = [...currentItems, ...newItems].map((it, idx) => ({
        ...it,
        order: idx + 1
      }))
      form.setValue('items', allItems, { shouldDirty: true })
    },
    [form]
  )

  const handleAddReference = useCallback(
    (ref: BibleReferenceDTO) => {
      const refKey = `${ref.book}-${ref.chapter}-${ref.verseStart}-${ref.verseEnd || ''}`
      if (addedRefs.has(refKey)) return

      const resolved = resolveRef(ref)
      if (!resolved) return

      addItemsToForm([{ type: 'BIBLE', accessData: resolved.accessData }])
      setAddedRefs((prev) => new Set([...prev, refKey]))
    },
    [addedRefs, resolveRef, addItemsToForm]
  )

  const handleAddAll = useCallback(() => {
    if (!result?.references) return

    const toAdd: { type: string; accessData: string; refKey: string }[] = []
    for (const ref of result.references) {
      const refKey = `${ref.book}-${ref.chapter}-${ref.verseStart}-${ref.verseEnd || ''}`
      if (addedRefs.has(refKey)) continue

      const resolved = resolveRef(ref)
      if (!resolved) continue

      toAdd.push({ type: 'BIBLE', accessData: resolved.accessData, refKey })
    }

    if (toAdd.length > 0) {
      addItemsToForm(toAdd.map(({ type, accessData }) => ({ type, accessData })))
      setAddedRefs((prev) => new Set([...prev, ...toAdd.map((r) => r.refKey)]))
    }
  }, [result, addedRefs, resolveRef, addItemsToForm])

  const formatReference = (ref: BibleReferenceDTO): string => {
    const range = ref.verseEnd ? `${ref.verseStart}-${ref.verseEnd}` : ref.verseStart
    return `${ref.book} ${ref.chapter}:${range}`
  }

  const handleOpenSettings = () => {
    window.windowAPI.openSettingsWindow('ai')
  }

  const handleDismiss = () => {
    onOpenChange(false)
  }

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      {/* Alto acotado a la ventana: cabecera y pie fijos, el cuerpo hace scroll. */}
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Asistente IA para Cronograma
          </DialogTitle>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 space-y-4 overflow-y-auto px-6">
          {!isConfigured && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">Primero debes configurar una API Key de IA</p>
                <p className="text-xs text-muted-foreground">
                  Elegí un proveedor (OpenAI o Anthropic) y ingresá tu API Key para usar el
                  asistente.
                </p>
                <Button variant="outline" size="sm" onClick={handleOpenSettings}>
                  <Settings className="h-4 w-4 mr-1" />
                  Abrir Configuración
                </Button>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={isConfigured ? setActiveTab : undefined}>
            <TabsList className="grid w-full grid-cols-2" aria-disabled={!isConfigured}>
              <TabsTrigger
                value="text"
                className="flex items-center gap-2"
                disabled={!isConfigured}
              >
                <FileText className="h-4 w-4" />
                Texto
              </TabsTrigger>
              <TabsTrigger
                value="file"
                className="flex items-center gap-2"
                disabled={!isConfigured}
              >
                <File className="h-4 w-4" />
                Archivos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <Textarea
                placeholder="Pegá aquí el texto del sermón, bosquejo o notas del pastor.&#10;&#10;Ejemplo:&#10;Hoy estudiaremos Juan 3:16-21, donde Jesús habla del amor de Dios. También veremos Romanos 8:28 y Salmo 23..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="min-h-[150px] max-h-[200px] overflow-y-auto"
                disabled={!isConfigured}
              />
              <Button
                onClick={handleExtractFromText}
                disabled={isProcessing || !inputText.trim() || !isConfigured}
                className="w-full"
              >
                {isProcessing ? 'Extrayendo...' : 'Extraer Referencias'}
              </Button>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div
                role="button"
                tabIndex={canDrop ? 0 : -1}
                aria-disabled={!canDrop}
                onClick={() => canDrop && fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (canDrop && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  canDrop ? 'cursor-pointer hover:bg-muted/40' : 'cursor-not-allowed opacity-50',
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                )}
              >
                <Upload
                  className={cn('h-8 w-8', isDragging ? 'text-primary' : 'text-muted-foreground')}
                />
                <p className="text-sm font-medium">
                  {isDragging
                    ? 'Soltá el archivo aquí'
                    : 'Arrastrá un archivo o hacé clic para elegirlo'}
                </p>
                <p className="text-xs text-muted-foreground">PDF o Word (.docx, .doc)</p>
              </div>
              {docFile && (
                <div className="flex items-center gap-2 rounded-md border p-2">
                  {docFile.kind === 'pdf' ? (
                    <FileType2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm" title={docFile.path}>
                    {docFile.path.split(/[\\/]/).pop()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setDocFile(null)}
                    disabled={isProcessing}
                    aria-label="Quitar archivo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={DOC_ACCEPT}
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                onClick={handleExtractFromFile}
                disabled={isProcessing || !docFile || !isConfigured}
                className="w-full"
              >
                {isProcessing
                  ? docFile?.kind === 'pdf'
                    ? 'Procesando PDF...'
                    : 'Procesando documento...'
                  : 'Extraer del archivo'}
              </Button>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap break-words">{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {result.title && (
                <div className="text-sm">
                  <span className="font-medium">Título detectado:</span> {result.title}
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Se encontraron {result.references.length} referencia(s) bíblica(s):
              </div>

              <div className="space-y-2">
                {result.references.map((ref, idx) => {
                  const refKey = `${ref.book}-${ref.chapter}-${ref.verseStart}-${ref.verseEnd || ''}`
                  const isAdded = addedRefs.has(refKey)
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-md border',
                        isAdded ? 'bg-muted/50' : 'bg-background hover:bg-muted/30'
                      )}
                    >
                      <span className="text-sm">{formatReference(ref)}</span>
                      {isAdded ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => handleAddReference(ref)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>

              {result.references.length > 0 && (
                <Button
                  onClick={handleAddAll}
                  disabled={result.references.every((ref) => {
                    const refKey = `${ref.book}-${ref.chapter}-${ref.verseStart}-${ref.verseEnd || ''}`
                    return addedRefs.has(refKey)
                  })}
                  className="w-full"
                >
                  Agregar Todas al Cronograma
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-row items-center justify-end">
          {isConfigured && provider && (
            <div className="mr-auto flex min-w-0 flex-1 items-center gap-2 sm:max-w-56">
              {/* modal: el Dialog bloquea la rueda fuera de su contenido y la lista
                  se renderiza en un portal; el Popover modal la habilita de nuevo. */}
              {modelOptions.length > 0 ? (
                <Combobox
                  modal
                  type="modelo"
                  data={modelOptions}
                  value={aiConfig?.model ?? ''}
                  onValueChange={handleModelChange}
                >
                  <ComboboxTrigger
                    size="sm"
                    className="min-w-0 flex-1"
                    title={`Modelo de ${AI_PROVIDER_LABELS[provider]}`}
                    disabled={isProcessing}
                  />
                  <ComboboxContent>
                    <ComboboxInput
                      placeholder={`Buscar modelo de ${AI_PROVIDER_LABELS[provider]}...`}
                    />
                    <ComboboxEmpty>No se encontraron modelos</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxGroup>
                        {modelOptions.map((model) => (
                          <ComboboxItem key={model.value} value={model.value}>
                            {model.label}
                          </ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              ) : (
                !modelsQuery.isFetching && (
                  <span
                    className="truncate text-xs text-muted-foreground"
                    title={modelsQuery.isError ? 'No se pudieron cargar los modelos' : undefined}
                  >
                    {modelsQuery.isError
                      ? 'Modelos no disponibles'
                      : aiConfig?.model
                        ? formatModelLabel(aiConfig.model)
                        : 'Modelo por defecto'}
                  </span>
                )
              )}
              {modelsQuery.isFetching && (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleOpenSettings}>
            <Settings className="h-4 w-4 mr-1" />
            Configurar IA
          </Button>
          <Button variant="outline" onClick={handleDismiss}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
