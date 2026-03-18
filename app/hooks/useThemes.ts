import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

export const useThemes = () => {
  const { data = [], refetch } = useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      return window.api.themes.getAllThemes()
    }
  })

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('theme-saved', () => {
      console.log('invalidando query')
      refetch()
    })
    return unsubscribe
  }, [])

  return { themes: data, refetchThemes: refetch }
}

export const BlankTheme: ThemeWithMedia = {
  id: -1,
  name: 'Blank',
  background: '#ffffff',
  backgroundMediaId: null,
  deletedAt: null,
  textStyle: {
    color: '#000000',
    fontSize: 24,
    lineHeight: 1.2,
    letterSpacing: 0,
    fontFamily: 'Arial',
    textAlign: 'center',
    justifyContent: 'center'
  },
  previewImage: '',
  animationSettings: '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
  transitionSettings: '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
  createdAt: new Date(),
  updatedAt: new Date(),
  biblePresentationSettingsId: null,
  useDefaultBibleSettings: true,
  biblePresentationSettings: null,
  backgroundMedia: null
}
