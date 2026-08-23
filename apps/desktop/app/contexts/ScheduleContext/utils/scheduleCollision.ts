import { pointerWithin } from '@dnd-kit/core'
import type { ClientRect, Collision, CollisionDetection, DroppableContainer } from '@dnd-kit/core'

type Point = { x: number; y: number }

export const SCHEDULE_DROP_AREA_ID = 'schedule-drop-area'

/** Un drag externo (biblioteca o plantilla de grupo) trae `type` + `accessData` pero no `item`. */
export const isExternalDragData = (data: any) =>
  Boolean(data?.type) && data?.accessData !== undefined && !data?.item

const typeOfContainer = (container: DroppableContainer) => container.data.current?.type

const typeOfCollision = (collision: Collision) =>
  collision.data?.droppableContainer?.data?.current?.type

/** Distancia del puntero al borde del rect (0 si está dentro). */
const distanceToRect = (point: Point, rect: ClientRect) => {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right)
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom)
  return Math.hypot(dx, dy)
}

const nearestOfType = (
  args: Parameters<CollisionDetection>[0],
  type: string
): Collision[] => {
  const { droppableContainers, droppableRects, pointerCoordinates } = args
  if (!pointerCoordinates) return []

  let nearest: Collision | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const container of droppableContainers) {
    if (typeOfContainer(container) !== type) continue
    const rect = droppableRects.get(container.id)
    if (!rect) continue

    const distance = distanceToRect(pointerCoordinates, rect)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = { id: container.id, data: { droppableContainer: container, value: distance } }
    }
  }

  return nearest ? [nearest] : []
}

/**
 * `pointerWithin` por sí solo deja de detectar en cuanto el puntero cae en un hueco
 * entre items (márgenes, separadores), y cuando coincide con el contenedor del
 * cronograma el drop terminaba al final de la lista en vez de en medio.
 *
 * Estrategia:
 * 1. Zona concreta bajo el puntero (inserción para drags de biblioteca, item para reordenar).
 * 2. Si el puntero está dentro del cronograma pero en un hueco, la zona más cercana.
 * 3. Si no, lo que devuelva `pointerWithin` (cronograma vacío, carpetas de la biblioteca, etc.).
 */
export const scheduleCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  const targetType = isExternalDragData(args.active.data.current) ? 'insertion-zone' : 'item'

  const direct = pointerCollisions.filter((collision) => typeOfCollision(collision) === targetType)
  if (direct.length > 0) return direct

  if (pointerCollisions.some((collision) => collision.id === SCHEDULE_DROP_AREA_ID)) {
    const nearest = nearestOfType(args, targetType)
    if (nearest.length > 0) return nearest
  }

  return pointerCollisions
}
