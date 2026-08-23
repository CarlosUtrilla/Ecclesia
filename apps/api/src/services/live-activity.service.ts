/**
 * Rastrea si la app está proyectando en vivo, a partir de los eventos que ya se
 * reenvían por Socket.IO (`liveStateUpdate`, comandos `live*`, `obsTextUpdate`).
 *
 * Lo usa el scheduler de sync para no competir por CPU/disco durante un culto: un ciclo
 * hace red, escaneos del oplog completo, checksums y GC, y en equipos lentos eso se nota
 * como tirones justo mientras se está proyectando.
 */

/** Ventana tras la última acción de vivo en la que se sigue considerando "ocupado". */
export const LIVE_GRACE_MS = 60_000

let liveActive = false
let lastLiveActivityAt = 0

/** Eventos del relay que cuentan como actividad de vivo. */
export function isLiveEvent(event: string): boolean {
  return event.startsWith('live') || event === 'obsTextUpdate'
}

export function markLiveActivity(event: string, data?: unknown): void {
  if (!isLiveEvent(event)) return
  lastLiveActivityAt = Date.now()

  if (event === 'liveStateUpdate') {
    const state = data as { itemOnLive?: unknown; showLiveScreen?: boolean } | undefined
    liveActive = Boolean(state?.itemOnLive) || state?.showLiveScreen === true
    return
  }

  if (event === 'liveClearItem') {
    liveActive = false
    return
  }

  // Cualquier otro comando de vivo (siguiente slide, negro, logo…) implica que se está
  // operando la proyección; el siguiente `liveStateUpdate` corrige el estado real.
  liveActive = true
}

/** `true` si se está proyectando o hubo actividad de vivo hace menos de `LIVE_GRACE_MS`. */
export function isLiveBusy(now: number = Date.now()): boolean {
  return liveActive || now - lastLiveActivityAt < LIVE_GRACE_MS
}

export function getLiveActivityState(): { liveActive: boolean; lastLiveActivityAt: number } {
  return { liveActive, lastLiveActivityAt }
}

/** Solo para tests. */
export function resetLiveActivity(): void {
  liveActive = false
  lastLiveActivityAt = 0
}
