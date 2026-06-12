import { ipcRenderer } from 'electron'

export type BibleSearchData = {
  version: string
  bookId: number
  chapter: number
  verse: number
}

export const bibleSearchAPI = {
  sendBibleSearch: (data: BibleSearchData): void => {
    ipcRenderer.send('bible-search', data)
  },
  onBibleSearch: (callback: (data: BibleSearchData) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: BibleSearchData): void => {
      callback(data)
    }
    ipcRenderer.on('bible-search', handler)
    return () => {
      ipcRenderer.removeListener('bible-search', handler)
    }
  }
}
