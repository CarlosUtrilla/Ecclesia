export const clampBibleEdgeOffset = (next: number) => Math.min(Math.max(0, Math.round(next)), 72)

export const shouldDetachDefaultBibleSettings = (
  useDefaultBibleSettings: boolean,
  currentPositionStyle: number,
  nextPositionStyle: number
) => useDefaultBibleSettings && currentPositionStyle !== nextPositionStyle
