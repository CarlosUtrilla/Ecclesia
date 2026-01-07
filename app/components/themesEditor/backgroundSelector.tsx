import React from 'react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/ui/dropdown-menu'
import { ChevronDown, Palette, Image as ImageIcon, Video, Sparkles } from 'lucide-react'

type BackgroundType = 'color' | 'gradient' | 'image' | 'video'

interface BackgroundSelectorProps {
  backgroundType: BackgroundType
  value: string
  onTypeChange: (type: BackgroundType) => void
  onValueChange: (value: string) => void
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
  onValueChange
}: BackgroundSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground whitespace-nowrap">Fondo:</label>

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
          <DropdownMenuItem onClick={() => onTypeChange('gradient')} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Degradado
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
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={(e) => onValueChange(e.target.value)}
          className="h-8 w-20 cursor-pointer rounded border"
        />
      )}

      {backgroundType === 'gradient' && (
        <Input
          placeholder="linear-gradient(45deg, #667eea, #764ba2)"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="!bg-background text-xs flex-1 max-w-md h-8"
        />
      )}

      {backgroundType === 'image' && (
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="image/*"
            className="!bg-background text-xs max-w-xs h-8"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = (event) => {
                  onValueChange(event.target?.result as string)
                }
                reader.readAsDataURL(file)
              }
            }}
          />
          {value && (
            <Button size="sm" variant="ghost" onClick={() => onValueChange('')} className="h-8">
              Limpiar
            </Button>
          )}
        </div>
      )}

      {backgroundType === 'video' && (
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="video/*"
            className="!bg-background text-xs max-w-xs h-8"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = (event) => {
                  onValueChange(event.target?.result as string)
                }
                reader.readAsDataURL(file)
              }
            }}
          />
          {value && (
            <Button size="sm" variant="ghost" onClick={() => onValueChange('')} className="h-8">
              Limpiar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
