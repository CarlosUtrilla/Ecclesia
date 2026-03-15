import { getPrisma } from '../../../electron/main/prisma'
import type { AddFontDTO, DeleteFontDTO } from './fonts.dto'

export default class FontsService {
  async addFont(data: AddFontDTO) {
    const prisma = getPrisma()
    return await prisma.font.create({ data })
  }

  async getAllFonts() {
    const prisma = getPrisma()
    return await prisma.font.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    })
  }

  async deleteFont({ id }: DeleteFontDTO) {
    const prisma = getPrisma()
    return await prisma.font.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}
