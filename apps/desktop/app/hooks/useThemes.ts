import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { Api } from '@ecclesia/queries'
import { useQuery } from '@tanstack/react-query'

export const useThemes = () => {
  const { data = [], refetch } = useQuery(Api.query.themes.getAllThemes())

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
