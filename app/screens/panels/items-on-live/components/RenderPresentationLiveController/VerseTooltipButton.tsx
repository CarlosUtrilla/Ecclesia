import { ReactNode } from 'react'
import { Button } from '@/ui/button'
import { Tooltip } from '@/ui/tooltip'

type Props = {
  tooltipText: string
  onTooltipOpen: () => void
  onClick: () => void
  disabled: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  label: string
}

export default function VerseTooltipButton({
  tooltipText,
  onTooltipOpen,
  onClick,
  disabled,
  leftIcon,
  rightIcon,
  label
}: Props) {
  return (
    <Tooltip
      content={tooltipText}
      contentProps={{ side: 'top', align: 'center', sideOffset: 8, className: 'max-w-sm' }}
    >
      <span onMouseEnter={onTooltipOpen} onFocus={onTooltipOpen}>
        <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={disabled}>
          {leftIcon}
          {label}
          {rightIcon}
        </Button>
      </span>
    </Tooltip>
  )
}
