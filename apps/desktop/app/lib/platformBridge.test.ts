import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { platformBridge, isTauriOAuthAvailable } from './platformBridge'

const { listenMock } = vi.hoisted(() => ({ listenMock: vi.fn() }))

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock
}))

describe('platformBridge', () => {
  let originalWindow: typeof window

  beforeEach(() => {
    vi.resetAllMocks()
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

  it('debería escuchar eventos de Tauri cuando está disponible', async () => {
    const callback = vi.fn()
    const tauriUnlisten = vi.fn()
    listenMock.mockResolvedValue(tauriUnlisten)
    vi.stubGlobal('window', {
      electron: { openOAuthWindow: vi.fn() }
    })

    const cleanup = await platformBridge.listen('oauthCodeCaptured', callback)

    expect(listenMock).toHaveBeenCalledWith('oauthCodeCaptured', expect.any(Function))
    expect(typeof cleanup).toBe('function')

    // Simular que Tauri dispara el evento con payload
    const tauriWrapper = listenMock.mock.calls[0][1] as (event: { payload: unknown }) => void
    tauriWrapper({ payload: { code: 'abc' } })
    expect(callback).toHaveBeenCalledWith({ code: 'abc' })
  })

  it('debería retornar no-op listen cuando no está en Tauri', async () => {
    vi.stubGlobal('window', { electron: {} })

    const cleanup = await platformBridge.listen('oauthCodeCaptured', () => {})

    expect(listenMock).not.toHaveBeenCalled()
    expect(typeof cleanup).toBe('function')
  })
})
