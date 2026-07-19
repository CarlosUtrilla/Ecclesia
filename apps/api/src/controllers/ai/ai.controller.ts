import { RequestHandler } from '../../utils/RequestHandler'
import AIService from './ai.service'

export type SaveProviderConfigDTO = {
  provider: 'openai' | 'anthropic' | 'gemini'
  apiKey?: string
  model?: string
}

export type ExtractFromTextDTO = {
  text: string
}

export type ExtractFromPdfDTO = {
  pdfPath: string
}

export type ExtractFromDocxDTO = {
  docxPath: string
}

export default class AiController {
  private aiService = new AIService()

  async getProviderConfig() {
    return await this.aiService.getProviderConfig()
  }

  async saveProviderConfig({ body }: RequestHandler<SaveProviderConfigDTO>) {
    await this.aiService.saveProviderConfig(body)
    return await this.aiService.getProviderConfig()
  }

  async extractFromText({ body }: RequestHandler<ExtractFromTextDTO>) {
    return await this.aiService.extractFromText(body.text)
  }

  async extractFromPdf({ body }: RequestHandler<ExtractFromPdfDTO>) {
    return await this.aiService.extractFromPdf(body.pdfPath)
  }

  async extractFromDocx({ body }: RequestHandler<ExtractFromDocxDTO>) {
    return await this.aiService.extractFromDocx(body.docxPath)
  }
}
