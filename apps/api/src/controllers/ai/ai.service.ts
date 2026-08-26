import { getPrisma } from '../../prisma'
import { Prisma } from '@prisma/client'
import {
  AIProvider,
  ExtractedContent,
  AI_PROVIDER_DEFAULTS,
  AI_PROVIDER_LABELS,
  EXTRACTION_SYSTEM_PROMPT
} from './ai.types'
import { buildModelsRequest, parseModelsResponse } from './ai.models'
import * as pdfjsLib from 'pdfjs-dist'

type SettingRow = {
  key: string
  value: string
}

// Presupuesto de salida para extracción de referencias. Los modelos de razonamiento
// (GLM/Kimi/DeepSeek) consumen miles de tokens pensando antes de emitir el JSON.
const MAX_OUTPUT_TOKENS = 8192

export default class AIService {
  private log(...args: any[]) {
    if (typeof process !== 'undefined' && process.versions?.electron) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('electron-log').info('[AI]', ...args)
      } catch { /* silent fail */ }
    }
  }
  private async getRawSetting(key: string): Promise<string | null> {
    const prisma = getPrisma()
    const rows = await prisma.$queryRaw<SettingRow[]>(
      Prisma.sql`SELECT key, value FROM Setting WHERE key = ${key} LIMIT 1`
    )
    return rows.length > 0 ? rows[0].value : null
  }

  private async saveRawSetting(key: string, value: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO Setting (key, value, createdAt, updatedAt)
        VALUES (${key}, ${value}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updatedAt = CURRENT_TIMESTAMP
      `
    )
  }

  async getProviderConfig(): Promise<{ provider: AIProvider; model: string; hasKey: boolean }> {
    const provider = ((await this.getRawSetting('ai.provider')) as AIProvider) || 'gemini'
    const model =
      (await this.getRawSetting('ai.model')) || AI_PROVIDER_DEFAULTS[provider].model
    const apiKey = await this.getRawSetting('ai.apiKey')

    return {
      provider,
      model,
      hasKey: !!apiKey
    }
  }

  async saveProviderConfig(config: {
    provider: AIProvider
    apiKey?: string
    model?: string
  }): Promise<void> {
    await this.saveRawSetting('ai.provider', config.provider)
    if (config.apiKey !== undefined) {
      await this.saveRawSetting('ai.apiKey', config.apiKey)
    }
    if (config.model !== undefined) {
      await this.saveRawSetting('ai.model', config.model)
    }
  }

  async extractFromText(text: string): Promise<ExtractedContent> {
    const config = await this.getProviderConfig()
    if (!config.hasKey) {
      throw new Error('No hay API key configurada para IA. Configuralo en Ajustes.')
    }

    const apiKey = (await this.getRawSetting('ai.apiKey'))!
    const model = config.model

    this.log('Extrayendo referencias con', config.provider, '/', model)

    const result = await this.callProvider(config.provider, apiKey, model, text)
    return result
  }

  async extractFromPdf(pdfPath: string): Promise<ExtractedContent> {
    const text = await this.extractTextFromPdf(pdfPath)
    if (!text.trim()) {
      throw new Error('No se pudo extraer texto del PDF. El archivo podría estar vacío o ser una imagen.')
    }
    return this.extractFromText(text)
  }

  async extractFromDocx(docxPath: string): Promise<ExtractedContent> {
    const text = await this.extractTextFromDocx(docxPath)
    if (!text.trim()) {
      throw new Error('No se pudo extraer texto del documento. El archivo podría estar vacío.')
    }
    return this.extractFromText(text)
  }

  private async extractTextFromDocx(docxPath: string): Promise<string> {
    const fs = await import('fs')
    const buffer = await fs.promises.readFile(docxPath)

    // Word 97-2003 (.doc) usa el formato binario OLE, que mammoth no soporta.
    if (docxPath.toLowerCase().endsWith('.doc')) {
      return this.extractTextFromLegacyDoc(buffer)
    }

    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  private async extractTextFromLegacyDoc(buffer: Buffer): Promise<string> {
    const { default: WordExtractor } = await import('word-extractor')
    try {
      const doc = await new WordExtractor().extract(buffer)
      return doc.getBody()
    } catch (err: any) {
      this.log('extractTextFromLegacyDoc failed', err?.message)
      throw new Error(
        'No se pudo leer el archivo .doc. Guardalo como .docx desde Word y volvé a intentarlo.'
      )
    }
  }

  private async extractTextFromPdf(pdfPath: string): Promise<string> {
    const data = new Uint8Array(await (await import('fs')).promises.readFile(pdfPath))
    const doc = await pdfjsLib.getDocument({ data }).promise

    const textParts: string[] = []

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map((item: any) => item.str).join(' ')
      textParts.push(pageText)
    }

    return textParts.join('\n\n')
  }

  private async callProvider(
    provider: AIProvider,
    apiKey: string,
    model: string,
    userText: string
  ): Promise<ExtractedContent> {
    switch (provider) {
      case 'openai':
        return this.callOpenAI(apiKey, model, userText)
      case 'anthropic':
        return this.callAnthropic(apiKey, model, userText)
      case 'gemini':
        return this.callGemini(apiKey, model, userText)
      case 'openrouter':
        // OpenRouter es API-compatible con OpenAI (chat/completions)
        return this.callOpenAI(
          apiKey,
          model,
          userText,
          AI_PROVIDER_DEFAULTS.openrouter.baseUrl,
          AI_PROVIDER_LABELS.openrouter
        )
      case 'opencodego':
        // OpenCode Zen Go expone chat/completions para sus modelos open-source
        return this.callOpenAI(
          apiKey,
          model,
          userText,
          AI_PROVIDER_DEFAULTS.opencodego.baseUrl,
          AI_PROVIDER_LABELS.opencodego
        )
      default:
        throw new Error(`Proveedor no soportado: ${provider}`)
    }
  }

  /**
   * Lista los modelos disponibles directamente desde el proveedor usando la API key guardada.
   * OpenRouter permite listar sin key (catálogo público); el resto la exige.
   */
  async getAvailableModels(provider: AIProvider): Promise<{ provider: AIProvider; models: string[] }> {
    if (!AI_PROVIDER_DEFAULTS[provider]) {
      throw new Error(`Proveedor no soportado: ${provider}`)
    }

    const apiKey = await this.getRawSetting('ai.apiKey')
    if (!apiKey && provider !== 'openrouter') {
      throw new Error('No hay API key configurada. Configurala en Ajustes para listar modelos.')
    }

    const { url, headers } = buildModelsRequest(provider, apiKey)
    const response = await fetch(url, { headers })

    if (!response.ok) {
      const error = await response.text()
      this.log('List models error:', provider, error)
      throw new Error(
        this.formatProviderError(AI_PROVIDER_LABELS[provider], response.status, error)
      )
    }

    const payload = await response.json()
    const models = parseModelsResponse(provider, payload)

    if (models.length === 0) {
      throw new Error(`No se pudieron obtener modelos de ${AI_PROVIDER_LABELS[provider]}`)
    }

    return { provider, models }
  }

  private async callOpenAI(
    apiKey: string,
    model: string,
    userText: string,
    baseUrl: string = AI_PROVIDER_DEFAULTS.openai.baseUrl,
    providerLabel: string = AI_PROVIDER_LABELS.openai
  ): Promise<ExtractedContent> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: userText }
        ],
        temperature: 0.1,
        // Sin límite explícito, OpenRouter asume el máximo del modelo (16k+) y
        // rechaza con 402 cuando el saldo de créditos no alcanza. Los modelos de
        // razonamiento (GLM/Kimi/DeepSeek) gastan miles de tokens pensando antes
        // de responder, así que un límite chico deja `content` vacío.
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      this.log(providerLabel, 'error:', error)
      throw new Error(this.formatProviderError(providerLabel, response.status, error))
    }

    const data = await response.json()
    const choice = data.choices?.[0]
    const content = choice?.message?.content

    if (!content) {
      this.log(providerLabel, 'respuesta sin content:', JSON.stringify(choice)?.slice(0, 500))
      if (choice?.finish_reason === 'length') {
        throw new Error(
          `${providerLabel} agotó los tokens sin devolver respuesta (modelo de razonamiento). ` +
            'Probá con un modelo más liviano.'
        )
      }
      throw new Error(`Respuesta vacía de ${providerLabel}`)
    }

    return this.parseAIResponse(content)
  }

  private async callAnthropic(
    apiKey: string,
    model: string,
    userText: string
  ): Promise<ExtractedContent> {
    const response = await fetch(`${AI_PROVIDER_DEFAULTS.anthropic.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userText }],
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const error = await response.text()
      this.log('Anthropic error:', error)
      throw new Error(this.formatProviderError('Anthropic', response.status, error))
    }

    const data = await response.json()
    const content = data.content?.[0]?.text

    if (!content) {
      throw new Error('Respuesta vacía de Anthropic')
    }

    return this.parseAIResponse(content)
  }

  private async callGemini(
    apiKey: string,
    model: string,
    userText: string
  ): Promise<ExtractedContent> {
    const url = `${AI_PROVIDER_DEFAULTS.gemini.baseUrl}/models/${model}:generateContent?key=${apiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      this.log('Gemini error:', error)
      throw new Error(this.formatProviderError('Gemini', response.status, error))
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      throw new Error('Respuesta vacía de Gemini')
    }

    return this.parseAIResponse(content)
  }

  /**
   * Los tres proveedores devuelven el detalle en `{ error: { message } }`, así que
   * lo extraemos para poder mostrarlo en la UI en lugar de sólo el código HTTP.
   */
  private formatProviderError(provider: string, status: number, rawBody: string): string {
    let detail = ''
    try {
      const parsed = JSON.parse(rawBody)
      detail = parsed?.error?.message || parsed?.error?.status || parsed?.message || ''
    } catch {
      detail = rawBody.trim().slice(0, 300)
    }

    const hint =
      status === 401 || status === 403
        ? ' Revisá tu API key en Ajustes.'
        : status === 402
          ? ' Tu cuenta no tiene créditos suficientes para este modelo. Recargá créditos o elegí un modelo más barato.'
          : status === 429
            ? ' Superaste el límite de peticiones, esperá un momento.'
            : status === 503
              ? ' El modelo está sobrecargado, volvé a intentarlo en unos minutos.'
              : ''

    return `Error de ${provider} (${status})${detail ? `: ${detail}` : ''}${hint}`
  }

  private parseAIResponse(raw: string): ExtractedContent {
    try {
      let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        cleaned = jsonMatch[0]
      }

      const parsed = JSON.parse(cleaned)

      return {
        title: parsed.title || undefined,
        summary: parsed.summary || undefined,
        references: Array.isArray(parsed.references)
          ? parsed.references.map((ref: any) => ({
              book: String(ref.book || ''),
              bookShort: ref.bookShort ? String(ref.bookShort) : undefined,
              chapter: Number(ref.chapter),
              verseStart: Number(ref.verseStart),
              verseEnd: ref.verseEnd != null ? Number(ref.verseEnd) : undefined
            }))
          : []
      }
    } catch (e) {
      this.log('Error parsing response:', raw)
      throw new Error('No se pudo interpretar la respuesta de la IA')
    }
  }
}
