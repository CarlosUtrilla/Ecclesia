import { useEffect, useState } from 'react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Api } from '@ecclesia/queries'
import { Alert, AlertDescription } from '@/ui/alert'

type AIProvider = 'openai' | 'anthropic' | 'gemini'

type AIProviderConfig = {
  provider: AIProvider
  model: string
  hasKey: boolean
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini'
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
  }
}

const MODEL_OPTIONS: Record<AIProvider, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (bajo costo)' },
    { value: 'gpt-4o', label: 'GPT-4o (mayor precisión)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
  ],
  anthropic: [
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' }
  ],
  gemini: [
    { value: 'gemini-flash-latest', label: 'Gemini Flash — gratuito' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — gratuito' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — requiere facturación' }
  ]
}

export default function AISettingsSection() {
  const [config, setConfig] = useState<AIProviderConfig | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini')
  const [selectedModel, setSelectedModel] = useState('gemini-flash-latest')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

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
    setSelectedProvider(newProvider)
    const firstModel = MODEL_OPTIONS[newProvider][0].value
    setSelectedModel(firstModel)
    try {
      await Api.fetch.ai.saveProviderConfig({
        body: { provider: newProvider, model: firstModel }
      })
      await loadConfig()
    } catch (error) {
      console.error('Error saving provider:', error)
    }
  }

  const handleModelChange = async (newModel: string) => {
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
          model: selectedModel
        }
      })
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' })
      setApiKey('')
      await loadConfig()
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
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>API Key</Label>
          <Input
            type="password"
            placeholder={config?.hasKey ? '••••••••... (ya configurada)' : 'Ingresa tu API key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {config?.hasKey && 'Deja vacío para mantener la key actual'}
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
          <Label>Modelo</Label>
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS[selectedProvider].map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Button variant="outline" onClick={handleTest} disabled={isTesting || !config?.hasKey}>
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Probar conexión
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
