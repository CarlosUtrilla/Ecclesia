import { cn } from '@/lib/utils'
import { useVirtualizer } from '@tanstack/react-virtual'
import * as React from 'react'

interface VirtualizedScrollAreaProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  estimateSize: (index: number) => number
  className?: string
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
  className
}: VirtualizedScrollAreaProps<any>) => {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const count = items.length
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize
  })

  const indexes = virtualizer.getVirtualItems()

  return (
    <div ref={parentRef} className={cn('w-full overflow-y-auto contain-strict', className)}>
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
              {renderItem(items[virtualRow.index], virtualRow.index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

VirtualizedScrollArea.displayName = 'VirtualizedScrollArea'

export { VirtualizedScrollArea }
