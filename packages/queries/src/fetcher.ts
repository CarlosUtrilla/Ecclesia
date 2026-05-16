import Decimal from 'decimal.js'

export async function Fetcher(
  apiUrl: string,
  port: number,
  path: string,
  body?: any,
  token?: string
) {
  try {
    const url = `${apiUrl}:${port}${path}`
    const isFormData = body instanceof FormData
    const parsedBody = !isFormData ? serializeBody(body) : body
    const init: RequestInit = {
      headers: {
        ...(token && token !== '' ? { authorization: `Bearer ${token}` } : undefined),
        ...(!isFormData
          ? isStringJSON(parsedBody)
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

    return data
  } catch (e) {
    const error = e as Error
    console.error(`Error in Fetcher for ${path}:`, error)
    const parsedError = isStringJSON(error.message) ? JSON.parse(error.message) : error
    throw parsedError
  }
}

function isStringJSON(str: string) {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

function serializeBody(body: any) {
  if (!body || body === null) return body
  const serializedDecimalsBody = serializeDecimals(body)
  if (typeof serializedDecimalsBody === 'string') return serializedDecimalsBody
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
