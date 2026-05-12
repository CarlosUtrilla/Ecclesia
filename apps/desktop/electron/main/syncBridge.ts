import http from 'http'

const API_BASE = 'http://127.0.0.1:7777'

function apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
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
            resolve(JSON.parse(responseData))
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
    return Array.isArray(result)
  } catch {
    return false
  }
}

export async function syncPush(): Promise<unknown> {
  return apiRequest('POST', '/api/syncDrive/executeSync')
}

export async function syncPushSnapshot(): Promise<unknown> {
  return apiRequest('POST', '/api/syncDrive/pushSnapshot')
}

export async function syncGetStatus(): Promise<unknown> {
  return apiRequest('POST', '/api/syncDrive/getStatus')
}

export async function syncConfigure(config: Record<string, unknown>): Promise<unknown> {
  return apiRequest('POST', '/api/syncDrive/configure', { body: config })
}

export async function syncGetAuthUrl(): Promise<unknown> {
  return apiRequest('POST', '/api/syncDrive/getAuthUrl')
}

export async function syncSetOAuthToken(token: Record<string, unknown>): Promise<unknown> {
  return apiRequest('POST', '/api/syncDrive/setOAuthToken', { body: token })
}

export async function syncDisconnect(): Promise<unknown> {
  return apiRequest('POST', '/api/syncDrive/disconnect')
}
