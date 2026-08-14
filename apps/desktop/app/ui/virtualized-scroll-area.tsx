import { cn } from '@/lib/utils'
import { useVirtualizer } from '@tanstack/react-virtual'
import * as React from 'react'

interface VirtualizedScrollAreaProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  estimateSize: (index: number) => number
  className?: string
  /**
   * Cabecera fijada arriba del scroll. Recibe el índice del primer item visible para
   * que el consumidor decida qué mostrar (p. ej. la sección a la que pertenece).
   * Va aquí y no en el consumidor porque `position: sticky` no funciona dentro de las
   * filas: viven en un contenedor con `transform`, que crea un bloque contenedor propio.
   */
  renderStickyHeader?: (firstVisibleIndex: number) => React.ReactNode
}

function VirtualRow<T>({
  item,
  index,
  renderItem
}: {
  item: T
  index: number
  renderItem: (item: T, index: number) => React.ReactNode
}) {
  return <>{renderItem(item, index)}</>
}

export interface VirtualizedScrollAreaRef {
  scrollToIndex: (
    index: number,
    options?: {
      align?: 'start' | 'center' | 'end'
      behavior?: 'auto' | 'smooth'
    }
  ) => void
}

const VirtualizedScrollArea = ({
  items,
  renderItem,
  estimateSize,
  className,
  renderStickyHeader
}: VirtualizedScrollAreaProps<any>) => {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const count = items.length
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize
  })

  const indexes = virtualizer.getVirtualItems()

  // El virtualizer solo re-renderiza cuando cambia el rango visible, no en cada scroll:
  // para que la cabecera cambie justo al cruzar el borde superior leemos el scrollTop.
  const [stickyIndex, setStickyIndex] = React.useState(0)
  const stickyIndexRef = React.useRef(0)

  const handleScroll = React.useCallback(() => {
    if (!renderStickyHeader) return

    const offset = parentRef.current?.scrollTop ?? 0
    const virtualItems = virtualizer.getVirtualItems()
    const firstVisible = virtualItems.find((item) => item.end > offset) ?? virtualItems[0]
    if (!firstVisible || firstVisible.index === stickyIndexRef.current) return

    stickyIndexRef.current = firstVisible.index
    setStickyIndex(firstVisible.index)
  }, [renderStickyHeader, virtualizer])

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className={cn('w-full overflow-y-auto contain-strict', className)}
    >
      {renderStickyHeader ? (
        <div className="sticky top-0 z-20 h-0">{renderStickyHeader(stickyIndex)}</div>
      ) : null}
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${indexes[0]?.start ?? 0}px)`
          }}
        >
          {indexes.map((virtualRow) => (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
            >
              <VirtualRow
                item={items[virtualRow.index]}
                index={virtualRow.index}
                renderItem={renderItem}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

VirtualizedScrollArea.displayName = 'VirtualizedScrollArea'

export { VirtualizedScrollArea }
