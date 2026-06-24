// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getStatusMock = vi.fn()
const configureMock = vi.fn()
const getAuthUrlMock = vi.fn()
const exchangeOAuthCodeMock = vi.fn()
const disconnectMock = vi.fn()
let oauthCodeCapturedCallback: ((data: { code?: string; error?: string }) => void) | null = null
let oauthCompleteCallback: ((data: { success: boolean; email?: string; error?: string }) => void) | null = null
const openOAuthWindowMock = vi.fn()

vi.mock('@ecclesia/queries', () => ({
  Api: {
    fetch: {
      sync: {
        getStatus: (...args: unknown[]) => getStatusMock(...args),
        configure: (...args: unknown[]) => configureMock(...args),
        getAuthUrl: (...args: unknown[]) => getAuthUrlMock(...args),
        exchangeOAuthCode: (...args: unknown[]) => exchangeOAuthCodeMock(...args),
        disconnect: (...args: unknown[]) => disconnectMock(...args)
      }
    },
    socket: {
      listen: {
        syncProgress: vi.fn(() => vi.fn()),
        oauthCodeCaptured: vi.fn((cb: (data: { code?: string; error?: string }) => void) => {
          oauthCodeCapturedCallback = cb
          return vi.fn()
        }),
        oauthComplete: vi.fn((cb: (data: { success: boolean; email?: string; error?: string }) => void) => {
          oauthCompleteCallback = cb
          return vi.fn()
        })
      }
    }
  }
}))

import SyncSettingsSection from './syncSettingsSection'

describe('SyncSettingsSection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    oauthCodeCapturedCallback = null
    oauthCompleteCallback = null

    vi.stubGlobal('__TAURI__', {})
    vi.stubGlobal('electron', {
      openOAuthWindow: openOAuthWindowMock
    })

    localStorage.clear()
  })

  it('debería abrir la ventana OAuth in-app al conectar Google Drive en Tauri', async () => {
    getStatusMock.mockResolvedValue({
      connected: false,
      pendingRestore: false,
      systemHostname: 'test-pc'
    })
    configureMock.mockResolvedValue(undefined)
    getAuthUrlMock.mockResolvedValue({ authUrl: 'https://accounts.google.com/oauth?test=1' })

    render(<SyncSettingsSection />)

    await waitFor(() => expect(getStatusMock).toHaveBeenCalled())

    const enableSwitch = screen.getByRole('switch', { name: /Activar sincronización/i })
    await userEvent.click(enableSwitch)

    const connectButton = await screen.findByRole('button', { name: /Conectar Google/i })
    await userEvent.click(connectButton)

    await waitFor(() => {
      expect(configureMock).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(getAuthUrlMock).toHaveBeenCalledWith({
        body: { redirectUri: 'http://127.0.0.1:7777/oauth-redirect' }
      })
    })

    await waitFor(() => {
      expect(openOAuthWindowMock).toHaveBeenCalledWith('https://accounts.google.com/oauth?test=1')
    })
  })

  it('debería canjear el code y refrescar el estado cuando llega oauthCodeCaptured exitoso', async () => {
    getStatusMock
      .mockResolvedValueOnce({
        connected: false,
        pendingRestore: false,
        systemHostname: 'test-pc'
      })
      .mockResolvedValueOnce({
        connected: true,
        accountEmail: 'test@example.com',
        pendingRestore: false
      })
    configureMock.mockResolvedValue(undefined)
    getAuthUrlMock.mockResolvedValue({ authUrl: 'https://accounts.google.com/oauth?test=1' })
    exchangeOAuthCodeMock.mockResolvedValue({ email: 'test@example.com' })

    render(<SyncSettingsSection />)

    await waitFor(() => expect(getStatusMock).toHaveBeenCalled())

    const enableSwitch = screen.getByRole('switch', { name: /Activar sincronización/i })
    await userEvent.click(enableSwitch)

    const connectButton = await screen.findByRole('button', { name: /Conectar Google/i })
    await userEvent.click(connectButton)

    await waitFor(() => expect(openOAuthWindowMock).toHaveBeenCalled())

    oauthCodeCapturedCallback?.({ code: 'abc123' })

    await waitFor(() => expect(exchangeOAuthCodeMock).toHaveBeenCalledWith({ body: { code: 'abc123' } }))
    await waitFor(() => expect(getStatusMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Conectado con test@example.com/i)).toBeInTheDocument()
  })

  it('debería mostrar error cuando llega oauthCodeCaptured con error', async () => {
    getStatusMock.mockResolvedValue({
      connected: false,
      pendingRestore: false,
      systemHostname: 'test-pc'
    })
    configureMock.mockResolvedValue(undefined)
    getAuthUrlMock.mockResolvedValue({ authUrl: 'https://accounts.google.com/oauth?test=1' })

    render(<SyncSettingsSection />)

    await waitFor(() => expect(getStatusMock).toHaveBeenCalled())

    const enableSwitch = screen.getByRole('switch', { name: /Activar sincronización/i })
    await userEvent.click(enableSwitch)

    const connectButton = await screen.findByRole('button', { name: /Conectar Google/i })
    await userEvent.click(connectButton)

    await waitFor(() => expect(openOAuthWindowMock).toHaveBeenCalled())

    oauthCodeCapturedCallback?.({ error: 'El usuario canceló el permiso' })

    expect(await screen.findByText(/El usuario canceló el permiso/i)).toBeInTheDocument()
  })

  it('debería refrescar el estado cuando llega oauthComplete (fallback Electron/sidecar)', async () => {
    getStatusMock
      .mockResolvedValueOnce({
        connected: false,
        pendingRestore: false,
        systemHostname: 'test-pc'
      })
      .mockResolvedValueOnce({
        connected: true,
        accountEmail: 'test@example.com',
        pendingRestore: false
      })
    configureMock.mockResolvedValue(undefined)
    getAuthUrlMock.mockResolvedValue({ authUrl: 'https://accounts.google.com/oauth?test=1' })

    render(<SyncSettingsSection />)

    await waitFor(() => expect(getStatusMock).toHaveBeenCalled())

    const enableSwitch = screen.getByRole('switch', { name: /Activar sincronización/i })
    await userEvent.click(enableSwitch)

    const connectButton = await screen.findByRole('button', { name: /Conectar Google/i })
    await userEvent.click(connectButton)

    await waitFor(() => expect(openOAuthWindowMock).toHaveBeenCalled())

    oauthCompleteCallback?.({ success: true, email: 'test@example.com' })

    await waitFor(() => expect(getStatusMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Conectado con test@example.com/i)).toBeInTheDocument()
  })
})
