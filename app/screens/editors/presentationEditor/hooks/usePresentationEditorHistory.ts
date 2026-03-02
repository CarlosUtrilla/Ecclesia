import { useCallback, useEffect, useRef } from 'react'

export type PresentationEditorHistorySnapshot = {
  title: string
  slides: unknown[]
  selectedSlideIndex: number
  selectedItemId?: string
}

type Params = {
  snapshot: PresentationEditorHistorySnapshot
  onApplySnapshot: (snapshot: PresentationEditorHistorySnapshot) => void
  isCapturePaused?: boolean
  maxEntries?: number
}

const cloneSnapshot = (snapshot: PresentationEditorHistorySnapshot) =>
  JSON.parse(JSON.stringify(snapshot)) as PresentationEditorHistorySnapshot

export default function usePresentationEditorHistory({
  snapshot,
  onApplySnapshot,
  isCapturePaused = false,
  maxEntries = 100
}: Params) {
  const historyPastRef = useRef<PresentationEditorHistorySnapshot[]>([])
  const historyFutureRef = useRef<PresentationEditorHistorySnapshot[]>([])
  const historyLastSerializedRef = useRef('')
  const pendingSerializedWhilePausedRef = useRef<string | null>(null)
  const isApplyingHistoryRef = useRef(false)
  const snapshotRef = useRef(snapshot)

  snapshotRef.current = snapshot

  const applySnapshot = useCallback(
    (next: PresentationEditorHistorySnapshot) => {
      isApplyingHistoryRef.current = true
      onApplySnapshot(cloneSnapshot(next))
    },
    [onApplySnapshot]
  )

  const undoHistory = useCallback(() => {
    const previous = historyPastRef.current.pop()
    if (!previous) return

    historyFutureRef.current.push(cloneSnapshot(snapshotRef.current))
    applySnapshot(previous)
  }, [applySnapshot])

  const redoHistory = useCallback(() => {
    const next = historyFutureRef.current.pop()
    if (!next) return

    historyPastRef.current.push(cloneSnapshot(snapshotRef.current))
    applySnapshot(next)
  }, [applySnapshot])

  const seedHistory = useCallback((next: PresentationEditorHistorySnapshot) => {
    const serialized = JSON.stringify(next)
    historyPastRef.current = []
    historyFutureRef.current = []
    pendingSerializedWhilePausedRef.current = null
    historyLastSerializedRef.current = serialized
    isApplyingHistoryRef.current = false
  }, [])

  useEffect(() => {
    const serialized = JSON.stringify(snapshot)

    if (isApplyingHistoryRef.current) {
      historyLastSerializedRef.current = serialized
      isApplyingHistoryRef.current = false
      return
    }

    if (isCapturePaused) {
      pendingSerializedWhilePausedRef.current = serialized
      return
    }

    pendingSerializedWhilePausedRef.current = null

    if (!historyLastSerializedRef.current) {
      historyLastSerializedRef.current = serialized
      return
    }

    if (historyLastSerializedRef.current === serialized) {
      return
    }

    try {
      historyPastRef.current.push(
        JSON.parse(historyLastSerializedRef.current) as PresentationEditorHistorySnapshot
      )
      if (historyPastRef.current.length > maxEntries) {
        historyPastRef.current.shift()
      }
    } catch {
      historyPastRef.current = []
    }

    historyLastSerializedRef.current = serialized
    historyFutureRef.current = []
  }, [isCapturePaused, maxEntries, snapshot])

  return {
    undoHistory,
    redoHistory,
    seedHistory
  }
}
