import Logger from 'electron-log'

export async function Fetcher(apiUrl: string, path: string, body: any, token?: string) {
  try {
    const url = `${apiUrl}${path}`
    const init: RequestInit = {
      headers: {
        ...(token && token !== '' ? { authorization: `Bearer ${token}` } : undefined),
        ...(!(body instanceof FormData)
          ? isObjectParsableToString(body)
            ? { 'Content-Type': 'application/json' }
            : {
                'Content-Type': 'text/plain'
              }
          : undefined)
      },
      method: 'POST',
      ...(body && {
        body:
          body instanceof FormData
            ? body
            : isObjectParsableToString(body)
              ? JSON.stringify(body)
              : body
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

function isObjectParsableToString(str: any) {
  try {
    // Si no es un objeto o es null, no es parsable a string o no es un objeto válido
    if (typeof str !== 'object' || str === null || !str) return false
    JSON.stringify(str)
    return true
  } catch {
    return false
  }
}
