import * as React from 'react'

import { cn } from '../lib/utils'
import { Label } from './label'

export type InputProps = React.ComponentProps<'input'> & {
  label?: string
  error?: string
}

function Input({ className, type, error, label, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label ? <Label htmlFor={props.name || props.id}>{label}</Label> : null}
      <input
        type={type}
        data-slot="input"
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          className,
          {
            'border-destructive ring-destructive text-destructive placeholder:text-destructive/60 focus-visible:ring-destructive/50':
              error
          }
        )}
        aria-invalid={error ? true : undefined} // importante para accesibilidad + estilos
        {...props}
      />
      {error && <p className="text-destructive text-xs pl-2 mt-1">{error}</p>}
    </div>
  )
}
export { Input }
