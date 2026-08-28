import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
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
import { Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Api } from '@ecclesia/queries'
import { Alert, AlertDescription } from '@/ui/alert'

type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'opencodego'

type AIProviderConfig = {
  provider: AIProvider
  model: string
  hasKey: boolean
  /** Cada proveedor guarda su propia API key; esto indica cuales ya estan configurados. */
  hasKeyByProvider?: Partial<Record<AIProvider, boolean>>
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  opencodego: 'OpenCode Go'
}

const PROVIDER_DOCS: Record<AIProvider, { label: string; url: string }> = {
  openai: {
    label: 'platform.openai.com/api-keys',
    url: 'https://platform.openai.com/api-keys'
  },
  anthropic: {
    label: 'console.anthropic.com/settings/keys',
    url: 'https://console.anthropic.com/settings/keys'
  },
  gemini: {
    label: 'aistudio.google.com/apikey',
    url: 'https://aistudio.google.com/apikey'
  },
  openrouter: {
    label: 'openrouter.ai/settings/keys',
    url: 'https://openrouter.ai/settings/keys'
  },
  opencodego: {
    label: 'opencode.ai/auth (OpenCode Zen)',
    url: 'https://opencode.ai/auth'
  }
}

function formatModelLabel(id: string): string {
  const name = id.split('/').pop() ?? id
  return name
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => {
      if (/^(gpt|ai|llm|ocr)$/i.test(part)) return part.toUpperCase()
      if (/^\d/.test(part) || /^[a-z]\d/i.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

export default function AISettingsSection() {
  const [config, setConfig] = useState<AIProviderConfig | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini')
  const [selectedModel, setSelectedModel] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // La key es por proveedor: al cambiar el select hay que mirar la del proveedor
  // elegido, no la del que venia guardado como activo.
  const hasKeyForSelected = config?.hasKeyByProvider
    ? !!config.hasKeyByProvider[selectedProvider]
    : config?.provider === selectedProvider && !!config.hasKey

  const modelsQuery = useQuery({
    queryKey: ['ai-models', selectedProvider],
    queryFn: () => Api.fetch.ai.getAvailableModels({ body: { provider: selectedProvider } }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!config && (hasKeyForSelected || selectedProvider === 'openrouter')
  })

  const modelOptions = useMemo(
    () =>
      (modelsQuery.data?.models ?? []).map((id) => ({ value: id, label: formatModelLabel(id) })),
    [modelsQuery.data]
  )

  useEffect(() => {
    loadConfig()
  }, [])

  // Cuando llega la lista del proveedor, si el modelo guardado no existe en ella
  // se selecciona el primero y se persiste (cubre cambios de proveedor).
  useEffect(() => {
    const models = modelsQuery.data?.models
    if (modelsQuery.data?.provider !== selectedProvider) return
    if (!models?.length || models.includes(selectedModel)) return
    setSelectedModel(models[0])
    Api.fetch.ai
      .saveProviderConfig({ body: { provider: selectedProvider, model: models[0] } })
      .catch((error) => console.error('Error saving model:', error))
  }, [modelsQuery.data, selectedModel, selectedProvider])

  const loadConfig = async () => {
    try {
      const result = await Api.fetch.ai.getProviderConfig()
      setConfig(result)
      setSelectedProvider(result.provider)
      setSelectedModel(result.model)
    } catch (error) {
      console.error('Error loading AI config:', error)
    }
  }

  const handleProviderChange = async (newProvider: AIProvider) => {
    if (newProvider === selectedProvider) return
    setSelectedProvider(newProvider)
    // La key tipeada pertenece al proveedor anterior: se descarta para no guardarla en el nuevo.
    setApiKey('')
    setMessage(null)
    setSelectedModel('')
    try {
      await Api.fetch.ai.saveProviderConfig({ body: { provider: newProvider } })
      await loadConfig()
    } catch (error) {
      console.error('Error saving provider:', error)
    }
  }

  const handleModelChange = async (newModel: string) => {
    if (!newModel) return
    setSelectedModel(newModel)
    try {
      await Api.fetch.ai.saveProviderConfig({
        body: { provider: selectedProvider, model: newModel }
      })
      await loadConfig()
    } catch (error) {
      console.error('Error saving model:', error)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      await Api.fetch.ai.saveProviderConfig({
        body: {
          provider: selectedProvider,
          apiKey: apiKey || undefined,
          model: selectedModel || undefined
        }
      })
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' })
      setApiKey('')
      await loadConfig()
      modelsQuery.refetch()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al guardar' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    setMessage(null)

    try {
      await Api.fetch.ai.extractFromText({
        body: { text: 'Juan 3:16 es un versículo famoso.' }
      })
      setMessage({ type: 'success', text: 'Conexión exitosa con la IA' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al conectar con la IA' })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Asistente IA
        </CardTitle>
        <CardDescription>
          Configura el proveedor de IA para extraer referencias bíblicas de textos y PDFs.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Proveedor</Label>
          <Select
            value={selectedProvider}
            onValueChange={handleProviderChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Google Gemini — gratuito</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="openrouter">OpenRouter — multi-proveedor</SelectItem>
              <SelectItem value="opencodego">OpenCode Go — suscripción</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>API Key</Label>
          <Input
            type="password"
            placeholder={
              hasKeyForSelected
                ? `••••••••... (ya configurada para ${PROVIDER_LABELS[selectedProvider]})`
                : `Ingresa tu API key de ${PROVIDER_LABELS[selectedProvider]}`
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {hasKeyForSelected
              ? 'Deja vacío para mantener la key actual. Cada proveedor guarda su propia key.'
              : 'Cada proveedor guarda su propia key: la de otro proveedor no se reutiliza.'}
          </p>
          <Alert
            onClick={() => window.windowAPI.openExternal(PROVIDER_DOCS[selectedProvider].url)}
            variant="default"
          >
            <AlertDescription className="flex">
              Obtén tu key en{' '}
              <a href="" className="text-blue-500 underline">
                {PROVIDER_DOCS[selectedProvider].label} ↗
              </a>
            </AlertDescription>
          </Alert>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Modelo</Label>
            {modelsQuery.isFetching && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Cargando modelos de {PROVIDER_LABELS[selectedProvider]}...
              </span>
            )}
          </div>
          {modelOptions.length > 0 ? (
            <Combobox
              type="modelo"
              data={modelOptions}
              value={selectedModel}
              onValueChange={handleModelChange}
            >
              <ComboboxTrigger className="w-full" />
              <ComboboxContent>
                <ComboboxInput placeholder={`Buscar modelo de ${PROVIDER_LABELS[selectedProvider]}...`} />
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
            <Input value={selectedModel} disabled placeholder="Sin modelos disponibles" />
          )}
          {modelsQuery.isError && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              No se pudieron cargar los modelos. Verificá tu API key y{' '}
              <button
                type="button"
                className="underline"
                onClick={() => modelsQuery.refetch()}
              >
                reintentá
              </button>
            </p>
          )}
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 text-sm p-3 rounded-md ${
              message.type === 'success'
                ? 'text-green-600 bg-green-50 dark:bg-green-950/20'
                : 'text-destructive bg-destructive/10'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {message.text}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Guardar
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={isTesting || !hasKeyForSelected}>
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Probar conexión
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
