import { describe, expect, it } from 'vitest'
import { scheduleCollisionDetection, SCHEDULE_DROP_AREA_ID } from './scheduleCollision'

type Rect = { top: number; left: number; width: number; height: number }

const clientRect = ({ top, left, width, height }: Rect) => ({
  top,
  left,
  width,
  height,
  bottom: top + height,
  right: left + width
})

const container = (id: string, type: string | undefined, rect: Rect) => ({
  id,
  key: id,
  disabled: false,
  node: { current: null },
  rect: { current: clientRect(rect) },
  data: { current: type ? { type } : {} }
})

// Cronograma de 3 items: contenedor 0-300, cada item 100px de alto
const items = [
  container(SCHEDULE_DROP_AREA_ID, undefined, { top: 0, left: 0, width: 200, height: 300 }),
  container('insert-position-0', 'insertion-zone', { top: 0, left: 0, width: 200, height: 10 }),
  container('insert-position-1', 'insertion-zone', { top: 10, left: 0, width: 200, height: 90 }),
  container('insert-position-2', 'insertion-zone', { top: 110, left: 0, width: 200, height: 90 }),
  container('insert-position-3', 'insertion-zone', { top: 210, left: 0, width: 200, height: 90 })
]

const buildArgs = (
  containers: ReturnType<typeof container>[],
  pointer: { x: number; y: number } | null,
  activeData: Record<string, unknown>
) =>
  ({
    active: { id: 'drag', data: { current: activeData }, rect: { current: {} } },
    collisionRect: clientRect({ top: pointer?.y ?? 0, left: pointer?.x ?? 0, width: 10, height: 10 }),
    droppableRects: new Map(containers.map((c) => [c.id, c.rect.current])),
    droppableContainers: containers,
    pointerCoordinates: pointer
  }) as any

const libraryDrag = { type: 'SONG', accessData: 1 }
const internalDrag = { type: 'item', item: { id: 'abc' } }

describe('scheduleCollisionDetection', () => {
  describe('drag externo (biblioteca)', () => {
    it('prioriza la zona de inserción sobre el contenedor del cronograma', () => {
      const collisions = scheduleCollisionDetection(buildArgs(items, { x: 100, y: 150 }, libraryDrag))

      expect(collisions.map((c) => c.id)).toEqual(['insert-position-2'])
    })

    it('usa la zona más cercana cuando el puntero cae en un hueco entre items', () => {
      // y = 104 queda en el hueco entre insert-position-1 (…100) e insert-position-2 (110…)
      const collisions = scheduleCollisionDetection(buildArgs(items, { x: 100, y: 104 }, libraryDrag))

      expect(collisions).toHaveLength(1)
      expect(collisions[0].id).toBe('insert-position-1')
    })

    it('cae al contenedor cuando el cronograma está vacío', () => {
      const empty = [items[0]]
      const collisions = scheduleCollisionDetection(buildArgs(empty, { x: 100, y: 150 }, libraryDrag))

      expect(collisions.map((c) => c.id)).toEqual([SCHEDULE_DROP_AREA_ID])
    })

    it('no interfiere con droppables fuera del cronograma', () => {
      const folder = container('folder-drop-Fondos', 'folder', {
        top: 400,
        left: 0,
        width: 200,
        height: 100
      })
      const collisions = scheduleCollisionDetection(
        buildArgs([...items, folder], { x: 100, y: 450 }, libraryDrag)
      )

      expect(collisions.map((c) => c.id)).toEqual(['folder-drop-Fondos'])
    })
  })

  describe('drag interno (reordenar)', () => {
    const sortableItems = [
      items[0],
      container('item-a', 'item', { top: 10, left: 0, width: 200, height: 90 }),
      container('item-b', 'item', { top: 110, left: 0, width: 200, height: 90 })
    ]

    it('devuelve el item bajo el puntero', () => {
      const collisions = scheduleCollisionDetection(
        buildArgs(sortableItems, { x: 100, y: 150 }, internalDrag)
      )

      expect(collisions.map((c) => c.id)).toEqual(['item-b'])
    })

    it('usa el item más cercano cuando el puntero cae en un hueco', () => {
      const collisions = scheduleCollisionDetection(
        buildArgs(sortableItems, { x: 100, y: 104 }, internalDrag)
      )

      expect(collisions.map((c) => c.id)).toEqual(['item-a'])
    })
  })

  it('no devuelve colisiones sin coordenadas de puntero', () => {
    expect(scheduleCollisionDetection(buildArgs(items, null, libraryDrag))).toEqual([])
  })
})
