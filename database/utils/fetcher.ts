import Logger from 'electron-log'
import { serializeDecimals } from '../middleware/decimal'

export async function Fetcher(apiUrl: string, path: string, body: any, token?: string) {
  try {
    const url = `${apiUrl}${path}`
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
    Logger.error(`Error in Fetcher for ${path}:`, error)
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
