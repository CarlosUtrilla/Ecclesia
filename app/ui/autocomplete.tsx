import { Command as CommandPrimitive } from 'cmdk'
import { Check, ChevronDown, CircleX, Search } from 'lucide-react'
import { useState, useRef, useCallback, useMemo, useEffect, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

import { CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from './command'
import { Skeleton } from './skeleton'
import { Input } from './input'

export type Option = {
  value: number | string
  label: string
}

export type OptionGroup = {
  label: string
  options: Option[]
}

type AutoCompleteProps = {
  options?: Option[]
  groups?: OptionGroup[]
  beforeOptions?: React.ReactNode
  showAllOnFocus?: boolean
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
  contentPlacement?: 'top' | 'bottom'
}

export const AutoComplete = ({
  options,
  groups,
  beforeOptions,
  showAllOnFocus = false,
  placeholder,
  emptyMessage,
  value,
  onValueChange,
  disabled,
  isLoading = false,
  renderOption,
  inputValue: propsInputValue,
  onInputValueChange,
  className,
  contentPlacement = 'bottom'
}: AutoCompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const allOptions = useMemo(
    () => (groups ? groups.flatMap((g) => g.options) : (options ?? [])),
    [groups, options]
  )

  const [isOpen, setOpen] = useState(false)
  const selectedOption = allOptions.find((option) => option.value === value)
  const [inputValue, setInputValue] = useState<string>(
    propsInputValue || selectedOption?.label || ''
  )

  useEffect(() => {
    if (propsInputValue !== undefined) {
      setInputValue(propsInputValue)
      return
    }

    // Mantener sincronizado el label cuando las opciones llegan de forma asíncrona.
    if (!isOpen) {
      setInputValue(selectedOption?.label || '')
    }
  }, [propsInputValue, selectedOption?.label, isOpen])

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
        const optionToSelect = allOptions.find((option) => option.label === input.value)
        if (optionToSelect) {
          onValueChange?.(optionToSelect.value)
        }
      }

      if (event.key === 'Escape') {
        input.blur()
      }
    },
    [isOpen, allOptions, onValueChange]
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

  const handleFocus = () => {
    setOpen(true)

    if (!showAllOnFocus || propsInputValue !== undefined) {
      return
    }

    // Si el input muestra el label seleccionado, limpiamos la búsqueda para listar todo.
    if (selectedOption?.label && inputValue === selectedOption.label) {
      setInputValue('')
    }
  }

  return (
    <CommandPrimitive className="relative h-9" onKeyDown={handleKeyDown}>
      <div className="[&>div]:border-b-0 relative">
        <Search className="size-4 shrink-0 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
        <CommandInput
          ref={inputRef}
          value={inputValue}
          onValueChange={handleInputValue}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'px-9 h-9 min-w focus-visible:ring-0 focus-visible:border-input',
            className,
            {
              'pr-12': selectedOption
            }
          )}
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
      <div
        className={cn(
          'absolute z-[120] w-full rounded-lg bg-popover text-popover-foreground outline-none animate-in fade-in-0 zoom-in-95',
          contentPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
          isOpen ? 'block' : 'hidden'
        )}
      >
        <CommandList className="max-h-72 overflow-auto rounded-lg bg-popover border border-input text-popover-foreground shadow-lg">
          {isLoading ? (
            <CommandPrimitive.Loading>
              <div className="p-1">
                <Skeleton className="h-8 w-full" />
              </div>
            </CommandPrimitive.Loading>
          ) : null}
          {beforeOptions}
          {groups ? (
            groups.map((group, gi) => (
              <>
                {gi > 0 && <CommandSeparator key={`sep-${gi}`} />}
                <CommandGroup key={group.label} heading={group.label}>
                  {group.options.map((option) => {
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
              </>
            ))
          ) : allOptions.length > 0 && !isLoading ? (
            <CommandGroup>
              {allOptions.map((option) => {
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
    </CommandPrimitive>
  )
}
