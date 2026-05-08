import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from './label'

export type TextAreaProps = React.ComponentProps<'textarea'> & {
  label?: string
  error?: string
}

function Textarea({ className, label, error, ...props }: TextAreaProps) {
  return (
    <div>
      {Boolean(label) && <Label htmlFor={props.name || props.id}>{label}</Label>}
      <textarea
        data-slot="textarea"
        className={cn(
          'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
          {
            'border-destructive ring-destructive text-destructive placeholder:text-destructive/60 focus-visible:ring-destructive/50':
              error
          }
        )}
        {...props}
      />
      {error && <p className="text-destructive text-xs pl-2 mt-1">{error}</p>}
    </div>
  )
}

export { Textarea }
