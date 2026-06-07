import { QueryClient } from '@tanstack/react-query'

const SSE_PORT = 7777

let eventSource: EventSource | null = null
let currentQueryClient: QueryClient | null = null

function handleSSEMessage(event: MessageEvent): void {
  if (!currentQueryClient) return
  try {
    const keys = JSON.parse(event.data) as string[][]
    keys.forEach((key) => {
      currentQueryClient!.invalidateQueries({ queryKey: key })
    })
  } catch {
    /* ignorar parse errors */
  }
}

export function initSSE(queryClient: QueryClient, serverUrl = 'http://localhost'): void {
  currentQueryClient = queryClient
  if (eventSource) {
    eventSource.close()
  }
  const es = new EventSource(`${serverUrl}:${SSE_PORT}/api/remote/events`)
  es.addEventListener('query-keys-invalidate', handleSSEMessage)
  eventSource = es
}

export function switchSSEConnection(serverUrl: string | null): void {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  if (!currentQueryClient) return
  if (serverUrl) {
    const es = new EventSource(`${serverUrl}:${SSE_PORT}/api/remote/events`)
    es.addEventListener('query-keys-invalidate', handleSSEMessage)
    eventSource = es
  } else {
    const es = new EventSource(`http://localhost:${SSE_PORT}/api/remote/events`)
    es.addEventListener('query-keys-invalidate', handleSSEMessage)
    eventSource = es
  }
}
