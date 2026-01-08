import React, { useState } from 'react'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/ui/dropdown-menu'
import { ChevronDown, Palette, Image as ImageIcon, Video, Sparkles } from 'lucide-react'
import { MediaPicker, Media, MediaType } from '@/components/panels/library/media/exports'
import { ColorPicker } from '@/ui/colorPicker'
import { useMediaServer } from '@/contexts/MediaServerContext'

type BackgroundType = 'color' | 'gradient' | 'image' | 'video'

interface BackgroundSelectorProps {
  backgroundType: BackgroundType
  value: string
  onTypeChange: (type: BackgroundType) => void
  onValueChange: (value: string) => void
  onMediaChange?: (mediaId: number | null, media: Media | null) => void
  selectedMedia?: Media | null
}

const backgroundTypeLabels: Record<BackgroundType, string> = {
  color: 'Color Sólido',
  gradient: 'Degradado',
  image: 'Imagen',
  video: 'Video'
}

const backgroundTypeIcons: Record<BackgroundType, React.ReactNode> = {
  color: <Palette className="h-4 w-4" />,
  gradient: <Sparkles className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />
}

export default function BackgroundSelector({
  backgroundType,
  value,
  onTypeChange,
  onValueChange,
  onMediaChange,
  selectedMedia
}: BackgroundSelectorProps) {
  const { buildMediaUrl } = useMediaServer()
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [pickerType, setPickerType] = useState<MediaType | undefined>(undefined)

  const handleSelectMedia = async (media: Media) => {
    // Marcar que el background es un medio
    onValueChange('media')
    // Pasar el ID del medio y el objeto completo al parent
    onMediaChange?.(media.id, media)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-muted-foreground whitespace-nowrap">Fondo:</label>
      <div className="flex items-center gap-2">
        {/* Background Type Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-2">
              {backgroundTypeIcons[backgroundType]}
              <span className="text-xs">{backgroundTypeLabels[backgroundType]}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onTypeChange('color')} className="gap-2">
              <Palette className="h-4 w-4" />
              Color Sólido
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeChange('image')} className="gap-2">
              <ImageIcon className="h-4 w-4" />
              Imagen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTypeChange('video')} className="gap-2">
              <Video className="h-4 w-4" />
              Video
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Background Input based on type */}
        {backgroundType === 'color' && (
          <ColorPicker value={value || '#ffffff'} onChange={onValueChange} />
        )}

        {backgroundType === 'image' && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPickerType('IMAGE')
                setIsPickerOpen(true)
              }}
              className="h-8"
            >
              {value === 'media' && selectedMedia ? 'Cambiar imagen' : 'Seleccionar imagen'}
            </Button>
            {value === 'media' && selectedMedia && (
              <>
                <div className="h-8 w-8 rounded border overflow-hidden flex items-center justify-center bg-muted">
                  {selectedMedia.thumbnail ? (
                    <img
                      src={buildMediaUrl(selectedMedia.thumbnail)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onValueChange('')
                    onMediaChange?.(null, null)
                  }}
                  className="h-8"
                >
                  Limpiar
                </Button>
              </>
            )}
          </div>
        )}

        {backgroundType === 'video' && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPickerType('VIDEO')
                setIsPickerOpen(true)
              }}
              className="h-8"
            >
              {value === 'media' && selectedMedia ? 'Cambiar video' : 'Seleccionar video'}
            </Button>
            {value === 'media' && selectedMedia && (
              <>
                <div className="h-8 w-8 rounded border overflow-hidden flex items-center justify-center bg-muted">
                  {selectedMedia.thumbnail ? (
                    <img
                      src={buildMediaUrl(selectedMedia.thumbnail)}
                      alt="Video preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Video className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onValueChange('')
                    onMediaChange?.(null, null)
                  }}
                  className="h-8"
                >
                  Limpiar
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <MediaPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handleSelectMedia}
        filterType={pickerType}
        title={pickerType === 'IMAGE' ? 'Seleccionar imagen' : 'Seleccionar video'}
      />
    </div>
  )
}
