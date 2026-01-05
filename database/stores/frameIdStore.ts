let currentFrameId: number | null = null

export const frameIdStore = {
  set(id: number) {
    currentFrameId = id
  },
  get(): number | null {
    return currentFrameId
  },
  clear() {
    currentFrameId = null
  }
}
