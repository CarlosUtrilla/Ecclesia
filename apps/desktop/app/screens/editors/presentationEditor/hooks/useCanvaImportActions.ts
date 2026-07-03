import { UseFormSetValue } from 'react-hook-form'
import { Dispatch, SetStateAction } from 'react'
import { PresentationFormValues } from '../schema'
import {
  BASE_CANVAS_HEIGHT,
  BASE_CANVAS_WIDTH,
  createMediaSlide,
  parseCanvasItemStyle,
  buildCanvasItemStyle,
  withVideoLiveBehavior
} from '../utils/slideUtils'
import {
  CanvaResolvedAsset,
  extractCanvaSlideNumber,
  getCanvaSourceKeyFromMp4Path,
  getCanvaSourceKeyFromZipPath,
  getCanvaZipFolderBaseName,
  getNextAvailableFolderName,
  sortCanvaResolvedAssets
} from '../utils/canvaImport'
import { Api } from '@ecclesia/queries'

type Params = {
  slides: PresentationFormValues['slides']
  globalThemeId: number | null
  setValue: UseFormSetValue<PresentationFormValues>
  setSelectedSlideIndex: Dispatch<SetStateAction<number>>
  setSelectedItemId: Dispatch<SetStateAction<string | undefined>>
}

export default function useCanvaImportActions(params: Params) {
  const { slides, globalThemeId, setValue, setSelectedSlideIndex, setSelectedItemId } = params

  const createCanvaFullSlide = (mediaId: number, themeId?: number | null) => {
    const baseSlide = withVideoLiveBehavior(createMediaSlide(mediaId, themeId), 'auto')
    const baseItem = baseSlide.items[0]

    if (!baseItem) {
      return {
        ...baseSlide,
        textStyle: {
          ...baseSlide.textStyle,
          mediaWidth: 100,
          mediaHeight: 100,
          offsetX: 0,
          offsetY: 0
        }
      }
    }

    const currentStyle = parseCanvasItemStyle(baseItem.customStyle, 'MEDIA')
    const fullStyle = buildCanvasItemStyle(
      {
        ...currentStyle,
        x: 0,
        y: 0,
        width: BASE_CANVAS_WIDTH,
        height: BASE_CANVAS_HEIGHT
      },
      'MEDIA'
    )

    return {
      ...baseSlide,
      items: [
        {
          ...baseItem,
          customStyle: fullStyle
        }
      ],
      textStyle: {
        ...baseSlide.textStyle,
        mediaWidth: 100,
        mediaHeight: 100,
        offsetX: 0,
        offsetY: 0
      }
    }
  }

  const importCanvaAssetsAsSlides = async () => {
    const selectedFiles = await window.mediaAPI.selectFiles('all')
    if (selectedFiles.length === 0) return

    type SelectedFile = (typeof selectedFiles)[number]
    const mp4Files: SelectedFile[] = []
    const zipFiles: SelectedFile[] = []
    const rejectedFiles: SelectedFile[] = []
    for (const f of selectedFiles) {
      const lower = f.fileName.toLowerCase()
      if (lower.endsWith('.mp4')) mp4Files.push(f)
      else if (lower.endsWith('.zip')) zipFiles.push(f)
      else rejectedFiles.push(f)
    }

    const rootFolders = await Api.fetch.media.listFolders({ body: { parentFolder: undefined } })
    const occupiedFolderNames = new Set(rootFolders)

    const resolvedMp4Paths: CanvaResolvedAsset[] = []
    let zipWithoutMp4Count = 0
    let zipExtractionFailureCount = 0

    for (const mp4File of mp4Files) {
      resolvedMp4Paths.push({
        fileName: mp4File.fileName,
        bytes: mp4File.bytes,
        sourceKey: getCanvaSourceKeyFromMp4Path(mp4File.fileName),
        slideNumber: extractCanvaSlideNumber(mp4File.fileName)
      })
    }

    for (const zipFile of zipFiles) {
      try {
        const folderBaseName = getCanvaZipFolderBaseName(zipFile.fileName)
        const folderName = getNextAvailableFolderName(folderBaseName, occupiedFolderNames)
        occupiedFolderNames.add(folderName)
        await Api.fetch.media.createFolder({ body: { folderPath: folderName } })

        const fd = new FormData()
        const blob = new Blob([zipFile.bytes])
        fd.append('file', blob, zipFile.fileName)
        fd.append('folder', folderName)
        const extracted = await Api.fetch.media.extractZipMp4(fd)

        if (!extracted || extracted.length === 0) {
          zipWithoutMp4Count += 1
          continue
        }

        for (const mediaRecord of extracted) {
          resolvedMp4Paths.push({
            fileName: mediaRecord.fileName || `${mediaRecord.name}.mp4`,
            bytes: new Uint8Array(0),
            mediaId: Number(mediaRecord.id),
            folder: folderName,
            sourceKey: getCanvaSourceKeyFromZipPath(zipFile.fileName),
            slideNumber: extractCanvaSlideNumber(mediaRecord.fileName || '')
          })
        }
      } catch {
        zipExtractionFailureCount += 1
      }
    }

    if (resolvedMp4Paths.length === 0) {
      const baseMessage = 'No se encontraron videos .mp4 para importar.'

      const details: string[] = []
      if (zipWithoutMp4Count > 0) {
        details.push(`${zipWithoutMp4Count} ZIP sin MP4`)
      }
      if (zipExtractionFailureCount > 0) {
        details.push(`${zipExtractionFailureCount} ZIP con error de extracción`)
      }

      alert(details.length > 0 ? `${baseMessage} (${details.join(', ')}).` : baseMessage)
      return
    }

    const sortedAssets = sortCanvaResolvedAssets(resolvedMp4Paths)
    const importedAssets: Array<{
      mediaId: number
      sourceKey: string
      slideNumber: number | null
    }> = []
    let failedImports = 0

    for (const entry of sortedAssets) {
      if (entry.mediaId) {
        importedAssets.push({
          mediaId: entry.mediaId,
          sourceKey: entry.sourceKey,
          slideNumber: entry.slideNumber
        })
        continue
      }
      try {
        const fd = new FormData()
        const blob = new Blob([entry.bytes])
        fd.append('file', blob, entry.fileName)
        if (entry.folder) fd.append('folder', entry.folder)
        const result = await Api.fetch.media.importFile(fd)
        const [mediaRecord] = result
        importedAssets.push({
          mediaId: Number(mediaRecord.id),
          sourceKey: entry.sourceKey,
          slideNumber: entry.slideNumber
        })
      } catch {
        failedImports += 1
      }
    }

    if (importedAssets.length === 0) {
      alert('No se pudo importar ningún video MP4 de Canva.')
      return
    }

    const nextSlides = [...slides]
    const canvaSlotToIndex = new Map<string, number>()

    for (let index = 0; index < nextSlides.length; index += 1) {
      const slide = nextSlides[index]
      if (!slide.canvaSourceKey || !slide.canvaSlideNumber) continue
      canvaSlotToIndex.set(
        `${slide.canvaSourceKey.toLowerCase()}::${slide.canvaSlideNumber}`,
        index
      )
    }

    let updatedSlidesCount = 0
    let appendedSlidesCount = 0

    for (const asset of importedAssets) {
      const hasStableSlot = asset.slideNumber !== null
      const slotKey = hasStableSlot ? `${asset.sourceKey}::${asset.slideNumber}` : ''
      const existingIndex = hasStableSlot ? canvaSlotToIndex.get(slotKey) : undefined

      if (existingIndex !== undefined) {
        const currentSlide = nextSlides[existingIndex]
        const replacement = createCanvaFullSlide(
          asset.mediaId,
          currentSlide.themeId ?? globalThemeId
        )

        nextSlides[existingIndex] = {
          ...replacement,
          id: currentSlide.id,
          themeId: currentSlide.themeId ?? globalThemeId ?? null,
          transitionSettings: currentSlide.transitionSettings || replacement.transitionSettings,
          videoLoop: currentSlide.videoLoop === true,
          videoLiveBehavior: currentSlide.videoLiveBehavior || replacement.videoLiveBehavior,
          canvaSourceKey: asset.sourceKey,
          canvaSlideNumber: asset.slideNumber ?? undefined
        }
        updatedSlidesCount += 1
        continue
      }

      const created = createCanvaFullSlide(asset.mediaId, globalThemeId)
      const createdWithCanvaMeta = {
        ...created,
        canvaSourceKey: asset.sourceKey,
        canvaSlideNumber: asset.slideNumber ?? undefined
      }

      nextSlides.push(createdWithCanvaMeta)
      appendedSlidesCount += 1

      if (hasStableSlot) {
        canvaSlotToIndex.set(slotKey, nextSlides.length - 1)
      }
    }

    setValue('slides', nextSlides, { shouldDirty: true })
    const lastSlide = nextSlides[nextSlides.length - 1]
    setSelectedSlideIndex(nextSlides.length - 1)
    setSelectedItemId(lastSlide?.items?.[0]?.id)

    const skippedByFormat = rejectedFiles.length
    const importedCount = importedAssets.length

    if (
      failedImports === 0 &&
      skippedByFormat === 0 &&
      zipWithoutMp4Count === 0 &&
      zipExtractionFailureCount === 0
    ) {
      const parts = [`Se importaron ${importedCount} videos.`]
      if (updatedSlidesCount > 0) parts.push(`${updatedSlidesCount} diapositiva(s) actualizada(s).`)
      if (appendedSlidesCount > 0) parts.push(`${appendedSlidesCount} diapositiva(s) agregada(s).`)
      alert(parts.join(' '))
      return
    }

    const parts = [`Se importaron ${importedCount} videos.`]
    if (updatedSlidesCount > 0) parts.push(`${updatedSlidesCount} diapositiva(s) actualizada(s).`)
    if (appendedSlidesCount > 0) parts.push(`${appendedSlidesCount} diapositiva(s) agregada(s).`)

    if (skippedByFormat > 0) {
      parts.push(`Se omitieron ${skippedByFormat} archivo(s) por no ser .mp4.`)
    }

    if (zipWithoutMp4Count > 0) {
      parts.push(`${zipWithoutMp4Count} ZIP no contenía videos .mp4.`)
    }

    if (zipExtractionFailureCount > 0) {
      parts.push(`Falló la extracción de ${zipExtractionFailureCount} ZIP.`)
    }

    if (failedImports > 0) {
      parts.push(`Fallaron ${failedImports} importación(es).`)
    }

    alert(parts.join(' '))
  }

  return { importCanvaAssetsAsSlides }
}
