import { getPrisma } from '../../../electron/main/prisma'

export class ScheduleGroupTemplateService {
  prisma = getPrisma()

  // Crear un nuevo template de grupo
  async createGroupTemplate(data: { name: string; color: string }) {
    return await this.prisma.scheduleGroupTemplate.create({ data })
  }

  // Obtener todos los templates de grupos
  async getAllGroupTemplates() {
    return await this.prisma.scheduleGroupTemplate.findMany({
      orderBy: { name: 'asc' }
    })
  }

  // Obtener un template por ID
  async getGroupTemplateById(id: number) {
    return await this.prisma.scheduleGroupTemplate.findUnique({ where: { id } })
  }

  // Actualizar un template de grupo
  async updateGroupTemplate(id: number, data: { name?: string; color?: string }) {
    return await this.prisma.scheduleGroupTemplate.update({ where: { id }, data })
  }

  // Eliminar un template de grupo
  async deleteGroupTemplate(id: number) {
    return await this.prisma.scheduleGroupTemplate.delete({ where: { id } })
  }
}
