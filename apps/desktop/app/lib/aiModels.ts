export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'opencodego'

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  opencodego: 'OpenCode Go'
}

export function formatModelLabel(id: string): string {
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
