let cachedApiBase: string | null = null

async function resolveApiBase(): Promise<string> {
  if (cachedApiBase) return cachedApiBase

  try {
    const port = await window.mediaAPI.getServerPort()
    cachedApiBase = `http://127.0.0.1:${port}/api`
  } catch {
    cachedApiBase = '/api'
  }
  return cachedApiBase
}

export async function Fetcher(apiUrl: string, path: string, body?: any, token?: string) {
  const base = await resolveApiBase()
  const url = `${base}${path}`

  const headers: Record<string, string> = {}
  if (token) headers['authorization'] = `Bearer ${token}`
  headers['Content-Type'] = 'application/json'

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text)
  }

  const contentType = response.headers.get('content-type')
  return contentType?.includes('application/json') ? response.json() : response.text()
}
