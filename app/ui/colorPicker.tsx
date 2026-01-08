import { useState, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { ChromePicker } from 'react-color'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  className?: string
}

export function ColorPicker({ value, onChange, className = 'h-8 w-20' }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [localColor, setLocalColor] = useState(value)

  useEffect(() => {
    setLocalColor(value)
  }, [value])

  const handleChange = (color: any) => {
    setLocalColor(color.hex)
    // Actualizar en tiempo real
    onChange(color.hex)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`cursor-pointer rounded border-2 ${className}`}
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <ChromePicker color={localColor} onChange={handleChange} />
      </PopoverContent>
    </Popover>
  )
}
