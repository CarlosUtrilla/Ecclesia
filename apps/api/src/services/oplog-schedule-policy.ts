/**
 * Política de agendado del sync: cuándo toca correr un ciclo y cuándo posponerlo.
 *
 * Un ciclo hace red, escaneos del oplog completo, checksums y GC. En equipos lentos eso
 * se nota, así que se limita la frecuencia y se posterga mientras se está proyectando.
 */

export const SYNC_INTERVAL_MS = 5 * 60 * 1000
/** Cualquier escritura en la BD agenda un ciclo; se coalescen en esta ventana. */
export const PENDING_SYNC_DEBOUNCE_MS = 60_000
/** Suelo entre ciclos automáticos: un ciclo es caro y no aporta nada correrlo seguido. */
export const MIN_SYNC_INTERVAL_MS = 2 * 60 * 1000
/** Reintento cuando el ciclo se posterga por estar en vivo. */
export const LIVE_RETRY_MS = 60_000
/**
 * Tope de lo que se puede postergar por estar en vivo: en un culto largo hay que
 * sincronizar en algún momento, así que tras esto se corre un ciclo aunque haya vivo.
 */
export const MAX_LIVE_DEFER_MS = 30 * 60 * 1000

/** `startup` y los disparos manuales no se posponen ni se limitan por intervalo. */
function isForcedReason(reason: string): boolean {
  return reason === 'startup' || reason === 'manual'
}

/**
 * Decide si toca correr el ciclo. Devuelve `{ run: false, retryIn }` cuando hay que
 * reintentar más tarde (en vivo, o demasiado pronto tras el ciclo anterior).
 */
export function evaluateCycle(
  reason: string,
  now: number,
  state: { lastSyncAt: number; deferredSince: number; liveBusy: boolean },
): { run: true } | { run: false; retryIn: number; deferred: boolean; motive: string } {
  if (isForcedReason(reason)) return { run: true }

  if (state.lastSyncAt > 0 && now - state.lastSyncAt < MIN_SYNC_INTERVAL_MS) {
    return {
      run: false,
      retryIn: MIN_SYNC_INTERVAL_MS - (now - state.lastSyncAt),
      deferred: false,
      motive: 'intervalo mínimo',
    }
  }

  if (state.liveBusy) {
    const deferredFor = state.deferredSince > 0 ? now - state.deferredSince : 0
    if (deferredFor < MAX_LIVE_DEFER_MS) {
      return { run: false, retryIn: LIVE_RETRY_MS, deferred: true, motive: 'en vivo' }
    }
  }

  return { run: true }
}
