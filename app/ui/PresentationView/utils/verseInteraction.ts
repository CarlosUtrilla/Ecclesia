export const VERSE_DRAG_ACTIVATION_THRESHOLD = 2

export const hasMeaningfulVerseDrag = (
  deltaYBase: number,
  threshold = VERSE_DRAG_ACTIVATION_THRESHOLD
) => Math.abs(deltaYBase) >= threshold

export const canProcessVerseDragMove = (buttons: number) => (buttons & 1) === 1
