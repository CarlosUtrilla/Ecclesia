import { Command as CommandPrimitive } from 'cmdk'
import { Check, ChevronDown, CircleX, Search } from 'lucide-react'
import { useState, useRef, useCallback, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

import { CommandGroup, CommandInput, CommandItem, CommandList } from './command'
import { Skeleton } from './skeleton'
import { Input } from './input'

export type Option = {
  value: number | string
  label: string
}

type AutoCompleteProps = {
  options: Option[]
  emptyMessage: string
  value?: number | string
  onValueChange?: (value: number | string) => void
  inputValue?: string
  onInputValueChange?: (value: string) => void
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  renderOption?: (option: Option, isSelected: boolean) => React.ReactNode
  className?: string
}

export const AutoComplete = ({
  options,
  placeholder,
  emptyMessage,
  value,
  onValueChange,
  disabled,
  isLoading = false,
  renderOption,
  inputValue: propsInputValue,
  onInputValueChange,
  className
}: AutoCompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const [isOpen, setOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value)
  const [inputValue, setInputValue] = useState<string>(
    propsInputValue || selectedOption?.label || ''
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current
      if (!input) {
        return
      }

      // Keep the options displayed when the user is typing
      if (!isOpen) {
        setOpen(true)
      }

      // This is not a default behaviour of the <input /> field
      if (event.key === 'Enter' && input.value !== '') {
        const optionToSelect = options.find((option) => option.label === input.value)
        if (optionToSelect) {
          onValueChange?.(optionToSelect.value)
        }
      }

      if (event.key === 'Escape') {
        input.blur()
      }
    },
    [isOpen, options, onValueChange]
  )

  const handleBlur = useCallback(() => {
    setOpen(false)
    setInputValue(selectedOption?.label || '')
  }, [selectedOption])

  const handleSelectOption = useCallback(
    (selectedOption: Option) => {
      setInputValue(selectedOption.label)
      onValueChange?.(selectedOption.value)

      // This is a hack to prevent the input from being focused after the user selects an option
      // We can call this hack: "The next tick"
      setTimeout(() => {
        inputRef?.current?.blur()
      }, 0)
    },
    [onValueChange]
  )

  const handleInputValue = (value: string) => {
    setInputValue(value)
    onInputValueChange?.(value)
  }

  return (
    <CommandPrimitive className="h-9" onKeyDown={handleKeyDown}>
      <div className="[&>div]:border-b-0 relative">
        <Search className="size-4 shrink-0 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
        <CommandInput
          ref={inputRef}
          value={inputValue}
          onValueChange={handleInputValue}
          onBlur={handleBlur}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn('px-9 h-9 min-w', className, {
            'pr-12': selectedOption
          })}
          containerClassName="px-0"
          hideIcon
          asChild
        >
          <Input />
        </CommandInput>
        <div className="absolute flex gap-1 right-3 top-1/2 -translate-y-1/2">
          {selectedOption ? (
            <CircleX
              onClick={() => {
                onValueChange?.('')
                setInputValue('')
                inputRef?.current?.focus()
              }}
              className="size-4 text-muted-foreground/60 cursor-pointer hover:text-red-500"
            />
          ) : null}
          <ChevronDown
            className={cn('size-4 text-muted-foreground/60 transition-transform', {
              'rotate-180': isOpen
            })}
          />
        </div>
      </div>
      <div className="relative mt-1">
        <div
          className={cn(
            'absolute top-0 z-10 w-full rounded-lg bg-white outline-none animate-in fade-in-0 zoom-in-95',
            isOpen ? 'block' : 'hidden'
          )}
        >
          <CommandList className="rounded-lg ring-1 ring-slate-200">
            {isLoading ? (
              <CommandPrimitive.Loading>
                <div className="p-1">
                  <Skeleton className="h-8 w-full" />
                </div>
              </CommandPrimitive.Loading>
            ) : null}
            {options.length > 0 && !isLoading ? (
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selectedOption?.value === option.value
                  const isCustomRender = typeof renderOption === 'function'
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      onSelect={() => handleSelectOption(option)}
                      className="flex w-full items-center gap-2 px-3 py-2"
                    >
                      {isCustomRender ? (
                        renderOption(option, isSelected)
                      ) : (
                        <>
                          {option.label}
                          {isSelected ? <Check className="w-4 ml-auto" /> : null}
                        </>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
            {!isLoading ? (
              <CommandPrimitive.Empty className="select-none rounded-sm px-2 py-3 text-center text-sm">
                {emptyMessage}
              </CommandPrimitive.Empty>
            ) : null}
          </CommandList>
        </div>
      </div>
    </CommandPrimitive>
  )
}
