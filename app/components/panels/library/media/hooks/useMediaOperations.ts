import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Media } from '../types'
import { MediaType } from '@prisma/client'

// Tipo para el DTO de Media
interface MediaDto {
  id: number
  name: string
  type: MediaType
  format: string
  filePath: string
  fileSize: number
  width?: number | null
  height?: number | null
  duration?: number | null
  thumbnail?: string | null
  folder?: string | null
  createdAt: Date
  updatedAt: Date
}

// Funciones auxiliares
const stripFilesPrefix = (filePath: string) =>
  filePath.startsWith('files/') ? filePath.substring(6) : filePath

const buildFolderPath = (currentFolder: string | null, folderName: string) =>
  currentFolder ? `${currentFolder}/${folderName}` : folderName

const normalizeFolder = (folder: string | null | undefined): string | null => folder ?? null

// Hook para operaciones de medios
export function useMediaOperations(currentFolder: string | null) {
  const queryClient = useQueryClient()

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['media'] })
    queryClient.invalidateQueries({ queryKey: ['folders'] })
  }

  // Importar archivos
  const importMutation = useMutation({
    mutationFn: async (filePaths: string[]) => {
      const results: MediaDto[] = []
      for (const filePath of filePaths) {
        const fileData = await window.mediaAPI.importFile(filePath, currentFolder ?? undefined)
        const media = await window.api.media.create(fileData)
        results.push(media)
      }
      return results
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] })
  })

   // Importar biblias
  const importBibleMutation = useMutation({
    mutationFn: async (filePaths: string[]) => {
      const results: MediaDto[] = []
      for (const filePath of filePaths) {
        const fileData = await window.mediaAPI.importFile(filePath, currentFolder ?? undefined)
        const media = await window.api.media.create(fileData)
        results.push(media)
      }
      return results
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] })
  })

  // Crear carpeta
  const createFolderMutation = useMutation({
    mutationFn: (folderName: string) =>
      window.mediaAPI.createFolder(buildFolderPath(currentFolder, folderName)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] })
  })

  // Eliminar carpeta
  const deleteFolderMutation = useMutation({
    mutationFn: (folderName: string) =>
      window.mediaAPI.deleteFolder(buildFolderPath(currentFolder, folderName)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] })
  })

  // Renombrar
  const renameMutation = useMutation({
    mutationFn: async ({
      oldPath,
      newName,
      isFolder,
      mediaId
    }: {
      oldPath: string
      newName: string
      isFolder: boolean
      mediaId?: number
    }) => {
      const result = await window.mediaAPI.rename(oldPath, newName, isFolder)

      if (isFolder) {
        // Actualizar archivos dentro de la carpeta renombrada
        const allMedia = await window.api.media.findAll({})
        const affectedFiles = allMedia.items.filter(
          (item: Media) => item.folder === oldPath || item.folder?.startsWith(`${oldPath}/`)
        )

        for (const file of affectedFiles) {
          const newFolder =
            file.folder === oldPath ? result.newPath : file.folder?.replace(oldPath, result.newPath)

          const newFilePath = file.filePath.startsWith(`files/${oldPath}/`)
            ? file.filePath.replace(`files/${oldPath}/`, `files/${result.newPath}/`)
            : file.filePath

          await window.api.media.update(file.id.toString(), {
            folder: newFolder ?? undefined,
            filePath: newFilePath
          })
        }
      } else if (mediaId) {
        // Actualizar archivo individual
        await window.api.media.update(mediaId.toString(), {
          filePath: `files/${result.newPath}`,
          name: newName
        })
      }

      return result
    },
    onSuccess: invalidateAll
  })

  // Eliminar
  const deleteMutation = useMutation({
    mutationFn: async (media: Media) => {
      await window.api.media.delete(media.id.toString())
      await window.mediaAPI.deleteFile(media.filePath, media.thumbnail)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] })
  })

  // Mover
  const moveMutation = useMutation({
    mutationFn: async ({
      sourcePath,
      targetFolder,
      isFolder,
      mediaId
    }: {
      sourcePath: string
      targetFolder: string | null
      isFolder: boolean
      mediaId?: number
    }) => {
      const result = await window.mediaAPI.move(sourcePath, targetFolder, isFolder)

      if (!isFolder && mediaId) {
        await window.api.media.update(mediaId.toString(), {
          filePath: `files/${result.newPath}`,
          folder: targetFolder
        })
      }

      return result
    },
    onSuccess: invalidateAll
  })

  // Copiar
  const copyMutation = useMutation({
    mutationFn: async ({
      sourcePath,
      targetFolder,
      isFolder,
      originalMedia
    }: {
      sourcePath: string
      targetFolder: string | null
      isFolder: boolean
      originalMedia?: Media
    }) => {
      const result = await window.mediaAPI.copyFile(sourcePath, targetFolder, isFolder)

      if (!isFolder && originalMedia) {
        await window.api.media.create({
          name: result.newFileName.replace(/\.[^/.]+$/, ''),
          type: originalMedia.type,
          format: originalMedia.format,
          filePath: `files/${result.newPath}`,
          fileSize: originalMedia.fileSize,
          width: originalMedia.width ?? undefined,
          height: originalMedia.height ?? undefined,
          duration: originalMedia.duration ?? undefined,
          thumbnail: result.newThumbnail ?? originalMedia.thumbnail ?? undefined,
          folder: targetFolder ?? undefined
        })
      }

      return result
    },
    onSuccess: invalidateAll
  })

  return {
    importMutation,
    createFolderMutation,
    deleteFolderMutation,
    renameMutation,
    deleteMutation,
    moveMutation,
    copyMutation,
    stripFilesPrefix,
    buildFolderPath,
    normalizeFolder,
    importBibleMutation
  }
}
