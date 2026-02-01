import { getPrisma } from '../../../electron/main/prisma'

export class ScheduleGroupTemplateService {
  prisma = getPrisma()

  // Crear un nuevo template de grupo
  async createGroupTemplate(data: { name: string; color: string }) {
    return await this.prisma.scheduleGroupTemplate.create({
      data
    })
  }

  // Obtener todos los templates de grupos
  async getAllGroupTemplates() {
    return await this.prisma.scheduleGroupTemplate.findMany({
      include: {
        scheduleGroups: true
      },
      orderBy: {
        name: 'asc'
      }
    })
  }

  // Obtener un template por ID
  async getGroupTemplateById(id: number) {
    return await this.prisma.scheduleGroupTemplate.findUnique({
      where: { id },
      include: {
        scheduleGroups: true
      }
    })
  }

  // Actualizar un template de grupo
  async updateGroupTemplate(id: number, data: { name?: string; color?: string }) {
    return await this.prisma.scheduleGroupTemplate.update({
      where: { id },
      data
    })
  }

  // Eliminar un template de grupo
  async deleteGroupTemplate(id: number) {
    // Primero verificar si tiene grupos asociados
    const template = await this.prisma.scheduleGroupTemplate.findUnique({
      where: { id },
      include: {
        scheduleGroups: true
      }
    })

    if (template?.scheduleGroups.length) {
      throw new Error('No se puede eliminar un template que tiene grupos asociados')
    }

    return await this.prisma.scheduleGroupTemplate.delete({
      where: { id }
    })
  }
}

export class ScheduleGroupService {
  prisma = getPrisma()

  // Crear un grupo basado en un template
  async createGroupFromTemplate(data: {
    templateId: number
    name?: string
    color?: string
    order: number
  }) {
    const template = await this.prisma.scheduleGroupTemplate.findUnique({
      where: { id: data.templateId }
    })

    if (!template) {
      throw new Error('Template de grupo no encontrado')
    }

    return await this.prisma.scheduleGroup.create({
      data: {
        name: data.name || template.name,
        color: data.color || template.color,
        order: data.order,
        groupTemplateId: data.templateId
      },
      include: {
        groupTemplate: true,
        scheduleItems: true
      }
    })
  }

  // Obtener todos los grupos
  async getAllGroups() {
    return await this.prisma.scheduleGroup.findMany({
      include: {
        groupTemplate: true,
        scheduleItems: true
      },
      orderBy: {
        order: 'asc'
      }
    })
  }

  // Obtener grupos por schedule
  async getGroupsBySchedule(scheduleId: number) {
    return await this.prisma.scheduleGroup.findMany({
      where: {
        scheduleItems: {
          some: {
            scheduleId
          }
        }
      },
      include: {
        groupTemplate: true,
        scheduleItems: {
          where: {
            scheduleId
          }
        }
      },
      orderBy: {
        order: 'asc'
      }
    })
  }

  // Actualizar orden de grupo
  async updateGroupOrder(id: number, order: number) {
    return await this.prisma.scheduleGroup.update({
      where: { id },
      data: { order }
    })
  }

  // Eliminar grupo
  async deleteGroup(id: number) {
    // Verificar si tiene items asociados
    const group = await this.prisma.scheduleGroup.findUnique({
      where: { id },
      include: {
        scheduleItems: true
      }
    })

    if (group?.scheduleItems.length) {
      throw new Error('No se puede eliminar un grupo que tiene items asociados')
    }

    return await this.prisma.scheduleGroup.delete({
      where: { id }
    })
  }
}
