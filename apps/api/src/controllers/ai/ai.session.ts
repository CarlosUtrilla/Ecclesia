import { randomUUID } from 'crypto'

let openCodeSessionId: string | null = null

/**
 * OpenCode Go (opencode.ai/zen/go/v1) exige el header `x-opencode-session` para
 * enrutar la petición y mantener el prompt caching. Devuelve un ID estable por
 * instancia del proceso, generado en el primer uso.
 */
export function getOpenCodeSessionId(): string {
  if (!openCodeSessionId) {
    openCodeSessionId = randomUUID()
  }
  return openCodeSessionId
}

/** Solo para tests: reinicia el ID para poder validar la generación. */
export function resetOpenCodeSessionId(): void {
  openCodeSessionId = null
}