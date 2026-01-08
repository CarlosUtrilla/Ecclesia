export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const buildFolderPath = (currentFolder: string | null, folderName: string): string =>
  currentFolder ? `${currentFolder}/${folderName}` : folderName

export const stripFilesPrefix = (filePath: string): string =>
  filePath.startsWith('files/') ? filePath.substring(6) : filePath

export const normalizeFolder = (folder: string | null | undefined): string | null =>
  folder ?? null
