import es from './es.json'
import en from './en.json'

type Language = 'es' | 'en'

type TranslationValue = string | { [key: string]: TranslationValue }

// Tipo recursivo para extraer todas las rutas posibles de las traducciones
type PathsToStringProps<T> = T extends string
  ? []
  : {
      [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>]
    }[Extract<keyof T, string>]

type Join<T extends string[], D extends string = '.'> = T extends []
  ? never
  : T extends [infer F]
    ? F
    : T extends [infer F, ...infer R]
      ? F extends string
        ? `${F}${D}${Join<Extract<R, string[]>, D>}`
        : never
      : string

type TranslationKeys = Join<PathsToStringProps<typeof es>>

const translations: Record<Language, Record<string, TranslationValue>> = {
  es,
  en
}

let currentLanguage: Language = 'es' // Idioma por defecto

export const setLanguage = (lang: Language) => {
  currentLanguage = lang
}

const getNestedValue = (obj: any, path: string[]): string | undefined => {
  return path.reduce((current, key) => current?.[key], obj)
}

export const t = (key: TranslationKeys, lang?: Language): string => {
  const language = lang || currentLanguage
  const keys = key.split('.')
  const value = getNestedValue(translations[language], keys)
  return typeof value === 'string' ? value : key // Si no encuentra, devuelve la key
}

export default t
