import http from 'http'

const API_BASE = 'http://127.0.0.1:7777'

async function apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE)
    const data = body ? JSON.stringify(body) : undefined

    const req = http.request(
      url,
      {
        method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : undefined
      },
      (res) => {
        let responseData = ''
        res.on('data', (chunk: Buffer) => (responseData += chunk.toString()))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData)
            resolve(parsed?.response ?? parsed)
          } catch {
            resolve(responseData)
          }
        })
      }
    )

    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const result = await apiRequest('POST', '/api/getRoutes')
    return !!(result as any)?.response ? true : Array.isArray(result)
  } catch {
    return false
  }
}

// --- Sync API methods (oplog namespace) ---

export function syncStatus(): Promise<unknown> {
  return apiRequest('POST', '/api/oplog/getSyncStatus')
}

export function syncConfigure(config: Record<string, unknown>): Promise<unknown> {
  return apiRequest('POST', '/api/oplog/configure', config)
}

export function syncConnect(config: Record<string, unknown>): Promise<unknown> {
  return apiRequest('POST', '/api/oplog/connect', config)
}

export function syncDisconnect(): Promise<unknown> {
  return apiRequest('POST', '/api/oplog/disconnect')
}

export function syncPush(): Promise<unknown> {
  return apiRequest('POST', '/api/oplog/push')
}

export function syncPull(): Promise<unknown> {
  return apiRequest('POST', '/api/oplog/pull')
}

export function syncGetAuthUrl(redirectUri?: string): Promise<unknown> {
  return apiRequest('POST', '/api/oplog/getAuthUrl', { redirectUri })
}

export function syncExchangeOAuthToken(code: string): Promise<unknown> {
  return apiRequest('POST', '/api/oplog/exchangeOAuthCode', { code })
}
