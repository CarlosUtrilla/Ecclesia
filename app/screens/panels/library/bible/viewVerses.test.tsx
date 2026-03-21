// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ViewVerses from './viewVerses'

vi.mock('@/contexts/ScheduleContext', () => ({
  useSchedule: () => ({
    addItemToSchedule: vi.fn()
  })
}))

vi.mock('@/contexts/ScheduleContext/utils/liveContext', () => ({
  useLive: () => ({
    showItemOnLiveScreen: vi.fn()
  })
}))

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false
  })
}))

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: (
    _ref: unknown,
    shortcuts: {
      onItemClick?: (item: { verseNumber: number; index: number }, event: React.MouseEvent) => void
    }
  ) => ({
    handleItemClick: (item: { verseNumber: number; index: number }, event: React.MouseEvent) => {
      shortcuts.onItemClick?.(item, event)
    },
    setContainerRef: vi.fn()
  })
}))

vi.mock('@/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  )
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const chapter = Number(queryKey[2])
    const data = Array.from({ length: 10 }, (_, index) => ({
      verse: index + 1,
      text: `texto-${chapter}-${index + 1}`
    }))
    return { data }
  }
}))

describe('ViewVerses', () => {
  it('reinicia el ancla al cambiar de capítulo y permite shift+click desde el verso seleccionado', async () => {
    const setSelectedVerse = vi.fn()

    const { rerender } = render(
      <ViewVerses
        bookData={{ id: 40, book: 'Mateo', book_id: 40 } as any}
        version="RVR"
        book={40}
        chapter={1}
        verse={[8]}
        setSelectedVerse={setSelectedVerse}
      />
    )

    fireEvent.click(screen.getByText('texto-1-9'))

    rerender(
      <ViewVerses
        bookData={{ id: 40, book: 'Mateo', book_id: 40 } as any}
        version="RVR"
        book={40}
        chapter={2}
        verse={[1]}
        setSelectedVerse={setSelectedVerse}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('texto-2-6')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('texto-2-6'), { shiftKey: true })

    expect(setSelectedVerse).toHaveBeenLastCalledWith([1, 2, 3, 4, 5, 6])
  })
})
