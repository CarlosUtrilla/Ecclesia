import Decimal from 'decimal.js'

type FetcherParams = {
  apiUrl: string
  port: number
  path: string
  body?: any
  token?: string
}
export async function Fetcher({ apiUrl, port, path, body, token }: FetcherParams) {
  try {
    const url = `${apiUrl}:${port}${path}`
    const isFormData = body instanceof FormData
    const parsedBody = !isFormData ? (serializeBody(body) as string | null) : body
    const init: RequestInit = {
      headers: {
        ...(token && token !== '' ? { authorization: `Bearer ${token}` } : undefined),
        ...(!isFormData
          ? isStringJSON(parsedBody as string | null)
            ? { 'Content-Type': 'application/json' }
            : {
                'Content-Type': 'text/plain'
              }
          : undefined)
      },
      method: 'POST',
      ...(body && {
        body: parsedBody
      })
    }

    const response = await fetch(url, init)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text)
    }

    const contentType = response.headers.get('content-type')

    const data = contentType?.includes('application/json')
      ? await response.json()
      : await response.text()
    if (data && typeof data === 'object') {
      if ('response' in data) return data.response
    }
    return data
  } catch (e) {
    const error = e as Error
    console.error(`Error in Fetcher for ${path}:`, error)
    throw normalizeError(error)
  }
}

/**
 * El API responde los errores como `{ error: string }`, por lo que `error.message`
 * llega siendo el JSON crudo. Devolvemos siempre un `Error` con el mensaje legible
 * y el payload original accesible en `error.payload`.
 */
function normalizeError(error: Error): Error {
  if (!isStringJSON(error.message)) return error

  const payload = JSON.parse(error.message)
  const message =
    typeof payload === 'string'
      ? payload
      : (payload?.error ?? payload?.message ?? error.message)

  const normalized = new Error(typeof message === 'string' ? message : error.message)
  ;(normalized as Error & { payload?: unknown }).payload = payload
  return normalized
}

function isStringJSON(str: string | null) {
  try {
    if (str === null) return false
    JSON.parse(str as string)
    return true
  } catch {
    return false
  }
}

/**Funcion que regresa el body como un string siempre, a menos que sea un null o undefined */
function serializeBody(body: any): string | null {
  if (!body || body === null) return null
  const serializedDecimalsBody = serializeDecimals(body)
  if (typeof body === 'string') return serializedDecimalsBody
  return JSON.stringify(serializedDecimalsBody)
}

export function serializeDecimals(obj: any): any {
  if (obj instanceof Decimal) {
    return { __decimal__: obj.toString() }
  }

  if (typeof obj === 'number') {
    return { __number__: obj.toString() }
  }

  if (obj instanceof Date) {
    return { __date__: obj.toISOString() }
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeDecimals)
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {}
    for (const key in obj) {
      result[key] = serializeDecimals(obj[key])
    }
    return result
  }

  return obj
}
