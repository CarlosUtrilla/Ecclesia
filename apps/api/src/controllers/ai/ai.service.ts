import { getPrisma } from '../../prisma'
import { Prisma } from '@prisma/client'
import {
  AIProvider,
  AIProviderConfig,
  ExtractedContent,
  AI_PROVIDER_DEFAULTS,
  EXTRACTION_SYSTEM_PROMPT
} from './ai.types'
import * as pdfjsLib from 'pdfjs-dist'
import log from 'electron-log'

type SettingRow = {
  key: string
  value: string
}

export default class AIService {
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

    log.info(`[AI] Extrayendo referencias con ${config.provider}/${model}`)

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
      throw new Error('No se pudo extraer texto del DOCX. El archivo podría estar vacío.')
    }
    return this.extractFromText(text)
  }

  private async extractTextFromDocx(docxPath: string): Promise<string> {
    const mammoth = await import('mammoth')
    const fs = await import('fs')
    const buffer = await fs.promises.readFile(docxPath)
    const result = await mammoth.extractRawText({ buffer })
    return result.value
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
      default:
        throw new Error(`Proveedor no soportado: ${provider}`)
    }
  }

  private async callOpenAI(
    apiKey: string,
    model: string,
    userText: string
  ): Promise<ExtractedContent> {
    const response = await fetch(`${AI_PROVIDER_DEFAULTS.openai.baseUrl}/chat/completions`, {
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
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      log.error('[AI] OpenAI error:', error)
      throw new Error(`Error de OpenAI: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('Respuesta vacía de OpenAI')
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
        max_tokens: 2048,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userText }],
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const error = await response.text()
      log.error('[AI] Anthropic error:', error)
      throw new Error(`Error de Anthropic: ${response.status}`)
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
      log.error('[AI] Gemini error:', error)
      throw new Error(`Error de Gemini: ${response.status}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      throw new Error('Respuesta vacía de Gemini')
    }

    return this.parseAIResponse(content)
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
      log.error('[AI] Error parsing response:', raw)
      throw new Error('No se pudo interpretar la respuesta de la IA')
    }
  }
}
