import { UserRole } from '@prisma/client'
import { authStore } from '../stores/authStore'
import { frameIdStore } from '../stores/frameIdStore'

const ROLE_META_KEY = Symbol('role_required')

export function WithRole(...role: UserRole[]) {
  return function (_: any, __: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const frameId = frameIdStore.get()
      if (!frameId) {
        throw 'No autorizado'
      }
      const user = authStore.get(frameId)
      if (!user) {
        throw 'No autorizado'
      }
      const userRole = user.role

      if (!role.includes(userRole)) {
        console.log('On decorator', `Required role: ${role}`, `Current role: ${userRole}`)
        throw 'No autorizado'
      }

      return await originalMethod.apply(this, args)
    }
  }
}

export function getRequiredRole(target: any, methodName: string): UserRole[] | undefined {
  return Reflect.getMetadata(ROLE_META_KEY, target, methodName)
}
