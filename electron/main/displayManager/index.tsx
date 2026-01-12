import { ipcMain, screen } from 'electron'

export function initializeDisplayManager() {
  // Obtener todas las pantallas disponibles
  ipcMain.handle('get-displays', () => {
    const displays = screen.getAllDisplays()
    return displays.map((display) => ({
      id: display.id,
      label: display.label || `Display ${display.id}`,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      internal: display.internal,
      aspectRatio: display.bounds.width / display.bounds.height
    }))
  })
}
