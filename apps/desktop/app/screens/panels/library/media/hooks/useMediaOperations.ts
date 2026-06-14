import { useMutation } from '@tanstack/react-query'
import { Media } from '../types'
import type { MediaType } from '@ecclesia/api'
import { Api } from '@ecclesia/queries'

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

const stripFilesPrefix = (filePath: string) =>
  filePath.startsWith('files/') ? filePath.substring(6) : filePath

const buildFolderPath = (currentFolder: string | null, folderName: string) =>
  currentFolder ? `${currentFolder}/${folderName}` : folderName

const normalizeFolder = (folder: string | null | undefined): string | null => folder ?? null

export function useMediaOperations(currentFolder: string | null) {
  const importMutation = useMutation({
    mutationFn: async (files: { fileName: string; bytes: Uint8Array; fileSize: number }[]) => {
      const results: MediaDto[] = []
      for (const file of files) {
        const formData = new FormData()
        const blob = new Blob([file.bytes])
        formData.append('file', blob, file.fileName)
        if (currentFolder) {
          formData.append('folder', currentFolder)
        }
        const result = await Api.fetch.media.importFile(formData)
        results.push(result[0])
      }
      return results
    }
  })

  const createFolderMutation = useMutation({
    mutationFn: (folderName: string) =>
      Api.fetch.media.createFolder({
        body: { folderPath: buildFolderPath(currentFolder, folderName) }
      })
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (folderName: string) =>
      Api.fetch.media.deleteFolder({
        body: { folderPath: buildFolderPath(currentFolder, folderName) }
      })
  })

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
      const result = await Api.fetch.media.renamePath({ body: { oldPath, newName } })

      if (isFolder) {
        const allMedia = await Api.fetch.media.findAll()
        const affectedFiles = allMedia.items.filter(
          (item: Media) => item.folder === oldPath || item.folder?.startsWith(`${oldPath}/`)
        )

        for (const file of affectedFiles) {
          const newFolder =
            file.folder === oldPath ? result.newPath : file.folder?.replace(oldPath, result.newPath)

          const newFilePath = file.filePath.startsWith(`files/${oldPath}/`)
            ? file.filePath.replace(`files/${oldPath}/`, `files/${result.newPath}/`)
            : file.filePath

          await Api.fetch.media.update({
            body: {
              id: file.id.toString(),
              data: {
                folder: newFolder ?? undefined,
                filePath: newFilePath
              }
            }
          })
        }
      } else if (mediaId) {
        await Api.fetch.media.update({
          body: {
            id: mediaId.toString(),
            data: {
              filePath: `files/${result.newPath}`,
              name: newName
            }
          }
        })
      }

      return result
    }
  })

  const deleteMutation = useMutation(Api.mutation.media.deleteFile)

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
      const result = await Api.fetch.media.movePath({ body: { sourcePath, targetFolder } })

      if (!isFolder && mediaId) {
        await Api.fetch.media.update({
          body: {
            id: mediaId.toString(),
            data: {
              filePath: `files/${result.newPath}`,
              folder: targetFolder
            }
          }
        })
      }

      return result
    }
  })

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
      const result = await Api.fetch.media.copyFile({
        body: { sourcePath, targetFolder, isFolder }
      })

      if (!isFolder && originalMedia) {
        await Api.fetch.media.create({
          body: {
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
          }
        })
      }

      return result
    }
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
    normalizeFolder
  }
}
