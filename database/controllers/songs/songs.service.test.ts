import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPrismaMock = vi.fn()

vi.mock('../../../electron/main/prisma', () => ({
  getPrisma: () => getPrismaMock()
}))

import SongsService from './songs.service'

describe('SongsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateSong guarda lyrics como json string y devuelve lyrics parseado', async () => {
    const songUpdateMock = vi.fn().mockResolvedValue({
      id: 1,
      title: 'Titulo nuevo',
      author: 'Autor',
      copyright: 'Copy',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      deletedAt: null,
      fullText: 'titulo nuevo',
      lyrics: JSON.stringify([
        { content: '<p>Nuevo 1</p>', tagSongsId: 1 },
        { content: '<p>Nuevo 2</p>', tagSongsId: 2 }
      ])
    })

    getPrismaMock.mockReturnValue({
      song: {
        update: songUpdateMock
      }
    })

    const service = new SongsService()

    const result = await service.updateSong(1, {
      title: 'Titulo nuevo',
      author: 'Autor',
      copyright: 'Copy',
      lyrics: [
        { content: '<p>Nuevo 1</p>', tagSongsId: 1 },
        { content: '<p></p>', tagSongsId: null },
        { content: '<p>Nuevo 2</p>', tagSongsId: 2 }
      ]
    })

    expect(songUpdateMock).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        title: 'Titulo nuevo',
        author: 'Autor',
        copyright: 'Copy',
        fullText: expect.any(String),
        lyrics: JSON.stringify([
          { content: '<p>Nuevo 1</p>', tagSongsId: 1 },
          { content: '<p>Nuevo 2</p>', tagSongsId: 2 }
        ])
      }
    })

    expect(result.lyrics).toEqual([
      { content: '<p>Nuevo 1</p>', tagSongsId: 1 },
      { content: '<p>Nuevo 2</p>', tagSongsId: 2 }
    ])
  })

  it('getSongById parsea lyrics json y tolera payload inválido', async () => {
    const songFindFirstMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: 2,
        title: 'Cancion A',
        author: null,
        copyright: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        deletedAt: null,
        fullText: 'cancion a',
        lyrics: '[{"content":"<p>A</p>","tagSongsId":null}]'
      })
      .mockResolvedValueOnce({
        id: 3,
        title: 'Cancion B',
        author: null,
        copyright: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        deletedAt: null,
        fullText: 'cancion b',
        lyrics: '{invalid json}'
      })

    getPrismaMock.mockReturnValue({
      song: {
        findFirst: songFindFirstMock
      }
    })

    const service = new SongsService()

    const parsed = await service.getSongById(2)
    const fallback = await service.getSongById(3)

    expect(parsed?.lyrics).toEqual([{ content: '<p>A</p>', tagSongsId: null }])
    expect(fallback?.lyrics).toEqual([])
  })
})
