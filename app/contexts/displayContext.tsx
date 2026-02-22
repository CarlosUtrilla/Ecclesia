import NewDisplayConected from '@/screens/new-display-connected'
import { ScreenRol } from '@prisma/client'
import { DisplayInfo } from 'electron/main/displayManager/displayType'
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react'

export interface DisplayWithUsage extends DisplayInfo {
  inUse: boolean
  type: ScreenRol | null
  aspectRatioCss: string
}

export type IDisplaysContext = {
  displays: DisplayWithUsage[]
  refresh: () => void
  mainDisplay: DisplayWithUsage | null
}
const DisplaysContext = createContext({} as IDisplaysContext)

export const DisplaysProvider = ({ children }: PropsWithChildren) => {
  const [openNewDisplay, setOpenNewDisplay] = useState(false)
  const [displays, setDisplays] = useState<DisplayWithUsage[]>([])
  const [mainDisplay, setMainDisplay] = useState<DisplayWithUsage | null>(null)
  const hasExecuted = useRef(false)

  const fetchDisplays = async () => {
    try {
      const displayInfo = await window.displayAPI.getDisplays()
      const savedDisplays = (await window.api.selectedScreens.getAllSelectedScreens()) || []

      // Comprobar si alguna de las pantallas del sistema no esta guardada o configurada
      const screenInUse = displayInfo.filter((display) =>
        savedDisplays.find((sd) => sd.screenId === display.id)
      )
      if (screenInUse.length !== displayInfo.length) {
        console.log('Some displays are not configured in selected screens')
        // Abrir ventana de gestión de displays desde el context
        window.displayAPI.showNewDisplayConnected()
      }
      const liveScreens: DisplayWithUsage[] = screenInUse
        .map((display) => {
          const savedDisplay = savedDisplays.find((sd) => sd.screenId === display.id)
          const type = savedDisplay ? savedDisplay.rol : null
          const inUse = type !== null
          const aspectRatioCss = `${display.bounds.width} / ${display.bounds.height}`
          return {
            ...display,
            inUse,
            type,
            aspectRatioCss
          }
        })
        .filter((d) => d.type !== null && d.inUse !== false)
      setDisplays(liveScreens)
      const mainDisplay = displayInfo.find((d) => d.isMain) || displayInfo[0]
      setMainDisplay({
        ...mainDisplay,
        inUse: true,
        type: null,
        aspectRatioCss: `${mainDisplay.bounds.width} / ${mainDisplay.bounds.height}`
      })
    } catch (err) {
      console.error('Error fetching displays:', err)
    }
  }

  useEffect(() => {
    // Evitar doble ejecución (React 18 Strict Mode)
    if (hasExecuted.current) return

    hasExecuted.current = true

    const unsuscribe = window.electron.ipcRenderer.on('display-update', () => {
      fetchDisplays()
    })

    fetchDisplays()

    return () => {
      unsuscribe()
    }
  }, [])

  // Función para refrescar la lista de pantallas
  const refresh = () => {
    fetchDisplays()
  }
  useEffect(() => {
    // Listener para abrir el dialog manualmente desde Electron
    const unsub = window.electron.ipcRenderer.on('open-new-display-connected', () => {
      setOpenNewDisplay(true)
    })
    return () => {
      unsub()
    }
  }, [])

  return (
    <DisplaysContext.Provider value={{ displays, refresh, mainDisplay }}>
      <NewDisplayConected open={openNewDisplay} onOpenChange={setOpenNewDisplay} />
      {children}
    </DisplaysContext.Provider>
  )
}

export const useDisplays = () => {
  const ctx = useContext(DisplaysContext)
  return ctx
}
