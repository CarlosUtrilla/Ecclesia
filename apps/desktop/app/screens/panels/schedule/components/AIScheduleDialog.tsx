import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog'
import { Textarea } from '@/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { ScrollArea } from '@/ui/scroll-area'
import { cn, generateUniqueId } from '@/lib/utils'
import { Api } from '@ecclesia/queries'
import { useSchedule } from '@/contexts/ScheduleContext'
import useBibleSchema from '@/hooks/useBibleSchema'
import { buildBibleAccessData } from '@/screens/panels/library/bible/accessData'
import { FileText, Upload, Sparkles, AlertCircle, CheckCircle2, Trash2, Plus, Settings, File, FileType2 } from 'lucide-react'
import type { ExtractedContentDTO, BibleReferenceDTO } from '@ecclesia/api/controllers/ai/ai.dto.d'

interface AIScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [docxPath, setDocxPath] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ExtractedContentDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addedRefs, setAddedRefs] = useState<Set<string>>(new Set())
  const [aiConfig, setAiConfig] = useState<{ hasKey: boolean; provider?: string } | null>(null)
  const { form } = useSchedule()
  const { bibleSchema } = useBibleSchema()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docxInputRef = useRef<HTMLInputElement>(null)

  const findBookByName = useMemo(() => {
    return (bookName: string) => {
      const normalized = normalizeString(bookName)
      return bibleSchema.find((b) => normalizeString(b.book) === normalized) || null
    }
  }, [bibleSchema])

  useEffect(() => {
    if (open) {
      Api.fetch.ai.getProviderConfig()
        .then((config) => setAiConfig(config))
        .catch(() => setAiConfig({ hasKey: false }))
    }
  }, [open])

  const isConfigured = aiConfig?.hasKey === true

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
    } catch (err: any) {
      setError(err.message || 'Error al extraer referencias. Verifica tu configuración de IA.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExtractFromPdf = async () => {
    if (!pdfPath) {
      setError('Por favor, selecciona un archivo PDF.')
      return
    }

    setIsProcessing(true)
    setError(null)
    setResult(null)

    try {
      const extracted = await Api.fetch.ai.extractFromPdf({ body: { pdfPath } })
      setResult(extracted)
    } catch (err: any) {
      setError(err.message || 'Error al procesar el PDF. Verifica tu configuración de IA.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSelectPdf = () => {
    fileInputRef.current?.click()
  }

  const handleSelectDocx = () => {
    docxInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const path = window.mediaAPI.getPathForFile(file)
      setPdfPath(path)
    }
  }

  const handleDocxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const path = window.mediaAPI.getPathForFile(file)
      setDocxPath(path)
    }
  }

  const handleExtractFromDocx = async () => {
    if (!docxPath) {
      setError('Por favor, selecciona un archivo DOCX.')
      return
    }

    setIsProcessing(true)
    setError(null)
    setResult(null)

    try {
      const extracted = await Api.fetch.ai.extractFromDocx({ body: { docxPath } })
      setResult(extracted)
    } catch (err: any) {
      setError(err.message || 'Error al procesar el DOCX. Verifica tu configuración de IA.')
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
      const verseRange = ref.verseEnd
        ? `${ref.verseStart}-${ref.verseEnd}`
        : String(ref.verseStart)
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
    onOpenChange(false)
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Asistente IA para Cronograma
          </DialogTitle>
        </DialogHeader>

        {!isConfigured && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Primero debes configurar una API Key de IA</p>
              <p className="text-xs text-muted-foreground">
                Elegí un proveedor (OpenAI o Anthropic) y ingresá tu API Key para usar el asistente.
              </p>
              <Button variant="outline" size="sm" onClick={handleOpenSettings}>
                <Settings className="h-4 w-4 mr-1" />
                Abrir Configuración
              </Button>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={isConfigured ? setActiveTab : undefined}>
          <TabsList className="grid w-full grid-cols-3" aria-disabled={!isConfigured}>
            <TabsTrigger value="text" className="flex items-center gap-2" disabled={!isConfigured}>
              <FileText className="h-4 w-4" />
              Texto
            </TabsTrigger>
            <TabsTrigger value="pdf" className="flex items-center gap-2" disabled={!isConfigured}>
              <FileType2 className="h-4 w-4" />
              PDF
            </TabsTrigger>
            <TabsTrigger value="docx" className="flex items-center gap-2" disabled={!isConfigured}>
              <File className="h-4 w-4" />
              DOCX
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <Textarea
              placeholder="Pegá aquí el texto del sermón, bosquejo o notas del pastor.&#10;&#10;Ejemplo:&#10;Hoy estudiaremos Juan 3:16-21, donde Jesús habla del amor de Dios. También veremos Romanos 8:28 y Salmo 23..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="min-h-[150px]"
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

          <TabsContent value="pdf" className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSelectPdf}
                disabled={isProcessing || !isConfigured}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {pdfPath ? 'Cambiar PDF' : 'Seleccionar PDF'}
              </Button>
              {pdfPath && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPdfPath(null)}
                  disabled={isProcessing || !isConfigured}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {pdfPath && (
              <div className="text-sm text-muted-foreground truncate">
                {pdfPath.split('/').pop()}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              onClick={handleExtractFromPdf}
              disabled={isProcessing || !pdfPath || !isConfigured}
              className="w-full"
            >
              {isProcessing ? 'Procesando PDF...' : 'Extraer del PDF'}
            </Button>
          </TabsContent>

          <TabsContent value="docx" className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSelectDocx}
                disabled={isProcessing || !isConfigured}
                className="flex-1"
              >
                <File className="h-4 w-4 mr-2" />
                {docxPath ? 'Cambiar DOCX' : 'Seleccionar DOCX'}
              </Button>
              {docxPath && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDocxPath(null)}
                  disabled={isProcessing || !isConfigured}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {docxPath && (
              <div className="text-sm text-muted-foreground truncate">
                {docxPath.split('/').pop()}
              </div>
            )}
            <input
              ref={docxInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleDocxChange}
            />
            <Button
              onClick={handleExtractFromDocx}
              disabled={isProcessing || !docxPath || !isConfigured}
              className="w-full"
            >
              {isProcessing ? 'Procesando DOCX...' : 'Extraer del DOCX'}
            </Button>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
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

            <ScrollArea className="h-[200px]">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddReference(ref)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>

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

        <DialogFooter>
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
