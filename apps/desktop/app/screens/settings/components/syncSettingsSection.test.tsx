// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getStatusMock = vi.fn()
const configureMock = vi.fn()
const getAuthUrlMock = vi.fn()
const disconnectMock = vi.fn()
let oauthCompleteCallback: ((data: { success: boolean; email?: string; error?: string }) => void) | null = null
const shellOpenMock = vi.fn()

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (...args: unknown[]) => shellOpenMock(...args)
}))

vi.mock('@ecclesia/queries', () => ({
  Api: {
    fetch: {
      sync: {
        getStatus: (...args: unknown[]) => getStatusMock(...args),
        configure: (...args: unknown[]) => configureMock(...args),
        getAuthUrl: (...args: unknown[]) => getAuthUrlMock(...args),
        disconnect: (...args: unknown[]) => disconnectMock(...args)
      }
    },
    socket: {
      listen: {
        syncProgress: vi.fn(() => vi.fn()),
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
    oauthCompleteCallback = null
    vi.stubGlobal('__TAURI__', {})
    localStorage.clear()
  })

  it('debería abrir el navegador con la URL de auth al conectar Google Drive', async () => {
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
      expect(shellOpenMock).toHaveBeenCalledWith('https://accounts.google.com/oauth?test=1')
    })
  })

  it('debería refrescar el estado cuando llega oauthComplete exitoso', async () => {
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

    await waitFor(() => expect(shellOpenMock).toHaveBeenCalled())

    oauthCompleteCallback?.({ success: true, email: 'test@example.com' })

    await waitFor(() => expect(getStatusMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Conectado con test@example.com/i)).toBeInTheDocument()
  })

  it('debería mostrar error cuando llega oauthComplete fallido', async () => {
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

    await waitFor(() => expect(shellOpenMock).toHaveBeenCalled())

    oauthCompleteCallback?.({ success: false, error: 'El usuario canceló el permiso' })

    expect(await screen.findByText(/El usuario canceló el permiso/i)).toBeInTheDocument()
  })
})
