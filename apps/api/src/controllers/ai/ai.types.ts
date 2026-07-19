export type AIProvider = 'openai' | 'anthropic' | 'gemini'

export type AIProviderConfig = {
  provider: AIProvider
  apiKey: string
  model?: string
}

export type BibleReference = {
  book: string
  bookShort?: string
  chapter: number
  verseStart: number
  verseEnd?: number
}

export type ExtractedContent = {
  references: BibleReference[]
  title?: string
  summary?: string
}

export const AI_PROVIDER_DEFAULTS: Record<AIProvider, { model: string; baseUrl: string }> = {
  openai: {
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1'
  },
  anthropic: {
    model: 'claude-3-5-haiku-20241022',
    baseUrl: 'https://api.anthropic.com'
  },
  gemini: {
    model: 'gemini-flash-latest',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
  }
}

export const EXTRACTION_SYSTEM_PROMPT = `Sos un asistente especializado en textos bíblicos cristianos.
Tu tarea es extraer todas las referencias bíblicas del texto proporcionado.

Reglas:
1. Identificá cada referencia bíblica (ej: "Juan 3:16", "Is 53:3-5", "Sal 23:1-6")
2. Convertí abreviaturas a nombres completos en español EXACTOS como aparecen en la Biblia Reina Valera 1960
3. Mantené el rango de versículos original
4. Detectá el título del sermón o bosquejo si existe
5. Respondé SOLO con JSON válido, sin markdown ni explicaciones
6. IMPORTANTE: Si el texto menciona versículos consecutivos del mismo capítulo por separado (ej: "Hechos 2:19, 2:20, 2:21" o "v.19, v.20 y v.21"), UNIFICALOS en un solo rango (ej: verseStart: 19, verseEnd: 21). No crees entradas separadas para versículos consecutivos del mismo capítulo.
7. Si los versículos NO son consecutivos (ej: "Hechos 2:19 y 2:25"), dejá entradas separadas.

Nombres EXACTOS de los libros (usá estos nombres, NO otros):
Génesis, Éxodo, Levítico, Números, Deuteronomio, Josué, Jueces, Rut, 1 Samuel, 2 Samuel, 1 Reyes, 2 Reyes, 1 Crónicas, 2 Crónicas, Esdras, Nehemías, Ester, Job, Salmos, Proverbios, Eclesiastés, Cantares, Isaías, Jeremías, Lamentaciones, Ezequiel, Daniel, Oseas, Joel, Amós, Abdías, Jonás, Miqueas, Nahúm, Habacuc, Sofonías, Hageo, Zacarías, Malaquías, Mateo, Marcos, Lucas, Juan, Hechos, Romanos, 1 Corintios, 2 Corintios, Gálatas, Efesios, Filipenses, Colosenses, 1 Tesalonicenses, 2 Tesalonicenses, 1 Timoteo, 2 Timoteo, Tito, Filemón, Hebreos, Santiago, 1 Pedro, 2 Pedro, 1 Juan, 2 Juan, 3 Juan, Judas, Apocalipsis

Formato de respuesta exacto:
{
  "title": "Título detectado o null",
  "references": [
    {
      "book": "Nombre completo del libro en español",
      "chapter": 3,
      "verseStart": 16,
      "verseEnd": null
    }
  ]
}

Si no hay referencias bíblicas, devolvé un array vacío de references.
Si el texto está en otro idioma (inglés, portugués), traducí los nombres de los libros al español usando los nombres de la lista anterior.
Si el texto dice "Isaías 53" sin versículos específicos, asumí que es desde el versículo 1 hasta el final del capítulo (verseEnd: null).
Si detectás un rango como "Juan 3:16-21", poné verseStart: 16 y verseEnd: 21.`
