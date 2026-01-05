import { UserRole } from '@prisma/client'

const sessionByFrame = new Map<number, { userId: number; role: UserRole }>()

export const authStore = {
  set(frameId: number, session: any) {
    sessionByFrame.set(frameId, session)
  },
  get(frameId: number) {
    return sessionByFrame.get(frameId)
  },
  clear(frameId: number) {
    sessionByFrame.delete(frameId)
  }
}
