import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { platformBridge, isTauriOAuthAvailable } from './platformBridge'

describe('platformBridge', () => {
  let originalWindow: typeof window

  beforeEach(() => {
    originalWindow = globalThis.window as unknown as typeof window
  })

  afterEach(() => {
    vi.stubGlobal('window', originalWindow)
  })

  it('debería llamar a ipcRenderer.send delegando al bridge', () => {
    const send = vi.fn()
    vi.stubGlobal('window', {
      electron: { ipcRenderer: { send } }
    })

    platformBridge.ipcRenderer.send('renderer-ready')

    expect(send).toHaveBeenCalledWith('renderer-ready')
  })

  it('debería llamar a ipcRenderer.on delegando al bridge y retornar unsub', () => {
    const on = vi.fn().mockReturnValue(() => {})
    vi.stubGlobal('window', {
      electron: { ipcRenderer: { on } }
    })

    const unsub = platformBridge.ipcRenderer.on('liveScreen-update', () => {})

    expect(on).toHaveBeenCalledWith('liveScreen-update', expect.any(Function))
    expect(typeof unsub).toBe('function')
  })

  it('debería llamar a openOAuthWindow en Tauri', () => {
    const openOAuthWindow = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', {
      electron: { openOAuthWindow }
    })

    void platformBridge.openOAuthWindow('https://oauth.test')

    expect(openOAuthWindow).toHaveBeenCalledWith('https://oauth.test')
  })

  it('debería lanzar error descriptivo si window.electron no existe', () => {
    vi.stubGlobal('window', {})

    expect(() => platformBridge.ipcRenderer.send('renderer-ready')).toThrow(
      /window\.electron no está disponible/
    )
  })

  it('debería lanzar error descriptivo si ipcRenderer.send no existe', () => {
    vi.stubGlobal('window', {
      electron: { ipcRenderer: {} }
    })

    expect(() => platformBridge.ipcRenderer.send('renderer-ready')).toThrow(
      /ipcRenderer\.send no está disponible/
    )
  })

  it('debería lanzar error descriptivo si openOAuthWindow no existe', () => {
    vi.stubGlobal('window', {
      electron: {}
    })

    expect(() => platformBridge.openOAuthWindow('https://oauth.test')).toThrow(
      /openOAuthWindow no está disponible/
    )
  })

  it('isTauriOAuthAvailable debería ser true solo si openOAuthWindow existe', () => {
    vi.stubGlobal('window', {
      electron: { openOAuthWindow: vi.fn() }
    })
    expect(isTauriOAuthAvailable()).toBe(true)

    vi.stubGlobal('window', {
      electron: {}
    })
    expect(isTauriOAuthAvailable()).toBe(false)
  })
})
