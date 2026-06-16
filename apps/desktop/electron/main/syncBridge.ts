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

// --- New sync API methods (delegate to SyncController via Express) ---

export function syncStatus(): Promise<unknown> {
  return apiRequest('POST', '/api/sync/getStatus')
}

export function syncConfigure(config: Record<string, unknown>): Promise<unknown> {
  return apiRequest('POST', '/api/sync/configure', config)
}

export function syncConnect(config: Record<string, unknown>): Promise<unknown> {
  return apiRequest('POST', '/api/sync/connect', config)
}

export function syncDisconnect(): Promise<unknown> {
  return apiRequest('POST', '/api/sync/disconnect')
}

export function syncPush(): Promise<unknown> {
  return apiRequest('POST', '/api/sync/push', { reason: 'manual-push' })
}

export function syncPull(): Promise<unknown> {
  return apiRequest('POST', '/api/sync/pull', { reason: 'manual-pull' })
}

export function syncReconcile(): Promise<unknown> {
  return apiRequest('POST', '/api/sync/reconcile')
}

export function syncGetRemoteData(): Promise<unknown> {
  return apiRequest('POST', '/api/sync/getRemoteData')
}

export function syncDiagnose(): Promise<unknown> {
  return apiRequest('POST', '/api/sync/diagnose')
}

export function syncHeal(diagnostic: unknown): Promise<unknown> {
  return apiRequest('POST', '/api/sync/heal', { diagnostic })
}

export function syncCleanupMedia(): Promise<unknown> {
  return apiRequest('POST', '/api/sync/cleanupMedia')
}

export function syncGetAuthUrl(): Promise<unknown> {
  return apiRequest('POST', '/api/sync/connect', { enabled: true, workspaceId: 'default', deviceName: 'Este dispositivo', conflictStrategy: 'lastWriteWins' })
}

export function syncSetOAuthToken(token: Record<string, unknown>): Promise<unknown> {
  return apiRequest('POST', '/api/sync/connect', { ...token, enabled: true, workspaceId: 'default', deviceName: 'Este dispositivo', conflictStrategy: 'lastWriteWins' })
}
