import { ElectronAPI } from '@electron-toolkit/preload'
import { MediaType } from '@prisma/client'

export interface DisplayInfo {
  id: number
  label: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  workArea: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
  rotation: number
  internal: boolean
  aspectRatio: number
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    windowAPI: {
      openSongWindow: (songId?: number) => void
      openThemeWindow: (themeId?: number) => void
    }
    systemAPI: {
      getSystemFonts: () => Promise<string[]>
      getDisplays: () => Promise<DisplayInfo[]>
    }
    mediaAPI: {
      selectFiles: (type: MediaType | 'all') => Promise<string[]>
      importFile: (
        sourcePath: string,
        folder?: string
      ) => Promise<{
        name: string
        type: MediaType
        format: string
        filePath: string
        fileSize: number
        thumbnail?: string
        folder?: string
      }>
      getFullPath: (fileName: string) => Promise<string>
      deleteFile: (filePath: string, thumbnail?: string | null) => Promise<boolean>
      createFolder: (folderPath: string) => Promise<{ success: boolean; path: string }>
      deleteFolder: (folderPath: string) => Promise<{ success: boolean }>
      rename: (
        oldPath: string,
        newName: string,
        isFolder: boolean
      ) => Promise<{ success: boolean; newPath: string }>
      listFolders: (parentFolder?: string) => Promise<string[]>
      move: (
        sourcePath: string,
        targetFolder: string | null,
        isFolder: boolean
      ) => Promise<{ success: boolean; newPath: string }>
      copyFile: (
        sourcePath: string,
        targetFolder: string | null,
        isFolder: boolean
      ) => Promise<{ success: boolean; newPath: string; newFileName: string; newThumbnail?: string }>
    }
  }
}
