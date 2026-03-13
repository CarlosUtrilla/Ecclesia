import { ResolvedTimer } from './types'
import { StageTimerTextLine } from './StageTimerTextLine'

type Props = {
  resolvedTimers: ResolvedTimer[]
  fontFamily: string
  resolveColor: (remainingMs: number) => string
  labelFontSizePx: number
  valueFontSizePx: number
  valueFontSizeMaxPx: number
  valueContainerWidthPx: number
  listClassName: string
  itemClassName: string
}

export function StageTimersList({
  resolvedTimers,
  fontFamily,
  resolveColor,
  labelFontSizePx,
  valueFontSizePx,
  valueFontSizeMaxPx,
  valueContainerWidthPx,
  listClassName,
  itemClassName
}: Props) {
  return (
    <div className={listClassName}>
      {resolvedTimers.map((timer) => (
        <div key={timer.key} className={itemClassName}>
          <StageTimerTextLine
            color={resolveColor(timer.remainingMs)}
            fontFamily={fontFamily}
            label={timer.label}
            value={timer.value}
            labelFontSizePx={labelFontSizePx}
            valueFontSizePx={valueFontSizePx}
            valueFontSizeMaxPx={valueFontSizeMaxPx}
            valueContainerWidthPx={valueContainerWidthPx}
          />
        </div>
      ))}
    </div>
  )
}
