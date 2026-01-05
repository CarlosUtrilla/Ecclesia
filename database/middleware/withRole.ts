import { UserRole } from '@prisma/client'
import { authStore } from '../stores/authStore'

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function withRole(requiredRole: UserRole[], handler: Function) {
  return async (event: Electron.IpcMainInvokeEvent, ...args: any[]) => {
    const session = authStore.get(event.frameId)
    if (!session || !requiredRole.includes(session.role)) {
      console.log(
        'On middleware',
        `Required role: ${requiredRole}`,
        `Current role: ${session?.role}`
      )
      throw 'No autorizado'
    }
    return handler(event, ...args)
  }
}
