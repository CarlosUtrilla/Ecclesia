import { PrismaClient } from '@prisma/client'
import { AddFontDTO, DeleteFontDTO } from './fonts.dto.d.ts'

const prisma = new PrismaClient()

export default class FontsService {
  async addFont(data: AddFontDTO) {
    return await prisma.font.create({ data })
  }

  async getAllFonts() {
    return await prisma.font.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async deleteFont({ id }: DeleteFontDTO) {
    return await prisma.font.delete({ where: { id } })
  }
}
