interface Window {
  mediaAPI: {
    getServerPort(): Promise<number>
  }
  electron: {
    ipcRenderer: {
      on(channel: string, listener: (...args: unknown[]) => void): () => void
    }
  }
}
