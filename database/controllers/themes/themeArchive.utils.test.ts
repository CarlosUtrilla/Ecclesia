import { describe, expect, it } from 'vitest'

import {
  buildMediaRelativePathFromArchive,
  buildUniqueThemeName,
  ensureZipExtension,
  getMediaFolderFromRelativePath,
  normalizeImportedMediaRelativePath,
  sanitizeThemeArchiveBaseName
} from './themeArchive.utils'

describe('themeArchive.utils', () => {
  describe('ensureZipExtension', () => {
    it('deberia agregar extension zip cuando falta', () => {
      expect(ensureZipExtension('/tmp/tema')).toBe('/tmp/tema.zip')
    })

    it('deberia mantener extension zip cuando ya existe', () => {
      expect(ensureZipExtension('/tmp/tema.ZIP')).toBe('/tmp/tema.ZIP')
    })
  })

  describe('sanitizeThemeArchiveBaseName', () => {
    it('deberia quitar acentos y caracteres no permitidos', () => {
      expect(sanitizeThemeArchiveBaseName('Tema Ñandú / Domingo!')).toBe('Tema Nandu  Domingo')
    })

    it('deberia devolver fallback cuando el nombre queda vacio', () => {
      expect(sanitizeThemeArchiveBaseName('***')).toBe('tema')
    })
  })

  describe('buildUniqueThemeName', () => {
    it('deberia conservar nombre si no existe conflicto', () => {
      expect(buildUniqueThemeName('Nuevo Tema', ['Tema A'])).toBe('Nuevo Tema')
    })

    it('deberia agregar sufijo importado en conflicto inicial', () => {
      expect(buildUniqueThemeName('Tema A', ['Tema A'])).toBe('Tema A (importado)')
    })

    it('deberia incrementar contador si ya existe sufijo importado', () => {
      expect(buildUniqueThemeName('Tema A', ['Tema A', 'Tema A (importado)'])).toBe(
        'Tema A (importado) 2'
      )
    })
  })

  describe('normalizeImportedMediaRelativePath', () => {
    it('deberia normalizar separadores y remover slash inicial', () => {
      expect(normalizeImportedMediaRelativePath('\\files\\fondos\\tema.mp4')).toBe(
        'files/fondos/tema.mp4'
      )
    })

    it('deberia devolver null para path traversal', () => {
      expect(normalizeImportedMediaRelativePath('../secreto.mp4')).toBeNull()
    })
  })

  describe('buildMediaRelativePathFromArchive', () => {
    it('deberia respetar path en files cuando es valido', () => {
      expect(buildMediaRelativePathFromArchive('files/navidad/fondo.mp4', 'Tema A', '.mp4')).toBe(
        'files/navidad/fondo.mp4'
      )
    })

    it('deberia usar fallback cuando path no pertenece a files', () => {
      expect(buildMediaRelativePathFromArchive('assets/background.mp4', 'Tema A', '.mp4')).toBe(
        'files/themes-imports/Tema A.mp4'
      )
    })
  })

  describe('getMediaFolderFromRelativePath', () => {
    it('deberia extraer carpeta relativa debajo de files', () => {
      expect(getMediaFolderFromRelativePath('files/navidad/2026/fondo.mp4')).toBe('navidad/2026')
    })

    it('deberia retornar undefined cuando esta en raiz de files', () => {
      expect(getMediaFolderFromRelativePath('files/fondo.mp4')).toBeUndefined()
    })
  })
})
