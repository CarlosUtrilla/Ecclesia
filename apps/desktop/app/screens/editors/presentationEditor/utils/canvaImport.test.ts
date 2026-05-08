import { describe, expect, it } from 'vitest'
import {
  extractCanvaSlideNumber,
  getCanvaSourceKeyFromMp4Path,
  getCanvaSourceKeyFromZipPath,
  getCanvaZipFolderBaseName,
  getNextAvailableFolderName,
  sortCanvaResolvedAssets,
  splitCanvaImportSourcePaths
} from './canvaImport'

describe('splitCanvaImportSourcePaths', () => {
  it('deberia separar mp4, zip y rechazados', () => {
    const result = splitCanvaImportSourcePaths([
      '/tmp/slide-1.mp4',
      '/tmp/slide-2.MP4',
      '/tmp/canva-pack.zip',
      '/tmp/cover.png',
      '/tmp/otro.mov'
    ])

    expect(result.mp4Paths).toEqual(['/tmp/slide-1.mp4', '/tmp/slide-2.MP4'])
    expect(result.zipPaths).toEqual(['/tmp/canva-pack.zip'])
    expect(result.rejectedPaths).toEqual(['/tmp/cover.png', '/tmp/otro.mov'])
  })

  it('deberia devolver arreglos vacios cuando no hay archivos', () => {
    const result = splitCanvaImportSourcePaths([])

    expect(result.mp4Paths).toEqual([])
    expect(result.zipPaths).toEqual([])
    expect(result.rejectedPaths).toEqual([])
  })
})

describe('getCanvaZipFolderBaseName', () => {
  it('deberia tomar el nombre del zip sin extension', () => {
    expect(getCanvaZipFolderBaseName('/tmp/Canva Slides.zip')).toBe('Canva Slides')
    expect(getCanvaZipFolderBaseName('C:\\tmp\\evento.ZIP')).toBe('evento')
  })

  it('deberia devolver fallback si el nombre es vacío', () => {
    expect(getCanvaZipFolderBaseName('/tmp/.zip')).toBe('Canva Import')
  })
})

describe('getNextAvailableFolderName', () => {
  it('deberia devolver el baseName cuando no existe', () => {
    const occupied = new Set<string>(['Otro'])
    expect(getNextAvailableFolderName('Canva Slides', occupied)).toBe('Canva Slides')
  })

  it('deberia agregar sufijo incremental cuando ya existe', () => {
    const occupied = new Set<string>(['Canva Slides', 'Canva Slides (1)', 'Canva Slides (2)'])
    expect(getNextAvailableFolderName('Canva Slides', occupied)).toBe('Canva Slides (3)')
  })
})

describe('extractCanvaSlideNumber', () => {
  it('deberia extraer números simples de nombre de archivo', () => {
    expect(extractCanvaSlideNumber('/tmp/1.mp4')).toBe(1)
    expect(extractCanvaSlideNumber('/tmp/010.mp4')).toBe(10)
  })

  it('deberia extraer el primer grupo numérico si no es totalmente numérico', () => {
    expect(extractCanvaSlideNumber('/tmp/slide-2.mp4')).toBe(2)
    expect(extractCanvaSlideNumber('/tmp/Canva Export 15 final.mp4')).toBe(15)
  })

  it('deberia devolver null cuando no hay número válido', () => {
    expect(extractCanvaSlideNumber('/tmp/intro.mp4')).toBeNull()
  })
})

describe('source keys de Canva', () => {
  it('deberia generar source key estable para zip', () => {
    expect(getCanvaSourceKeyFromZipPath('/tmp/Mi Evento.zip')).toBe('mi evento')
  })

  it('deberia generar source key estable para mp4 suelto', () => {
    expect(getCanvaSourceKeyFromMp4Path('/tmp/SLIDE 2.mp4')).toBe('mp4:slide 2')
  })
})

describe('sortCanvaResolvedAssets', () => {
  it('deberia ordenar por número y luego natural', () => {
    const sorted = sortCanvaResolvedAssets([
      {
        filePath: '/tmp/10.mp4',
        sourceKey: 'evento',
        slideNumber: 10
      },
      {
        filePath: '/tmp/2.mp4',
        sourceKey: 'evento',
        slideNumber: 2
      },
      {
        filePath: '/tmp/intro.mp4',
        sourceKey: 'evento',
        slideNumber: null
      }
    ])

    expect(sorted.map((item) => item.filePath)).toEqual(['/tmp/2.mp4', '/tmp/10.mp4', '/tmp/intro.mp4'])
  })
})
