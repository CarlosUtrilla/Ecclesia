import fs from 'fs'
import path from 'path'
import { getPrisma } from '../../prisma'
import { resolveFontsRoot, resolveMediaRoot } from '../../config'
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

  async uploadFont(file: Express.Multer.File) {
    const fontsDir = resolveFontsRoot()
    if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true })

    const fileName = file.originalname
    const destPath = path.join(fontsDir, fileName)
    fs.copyFileSync(file.path, destPath)

    // Clean up temp file from multer
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path)

    const name = fileName.replace(/\.[^/.]+$/, '').replace(/['"]/g, '').trim()

    const prisma = getPrisma()
    return await prisma.font.create({
      data: {
        name,
        fileName,
        filePath: 'fonts/' + fileName
      }
    })
  }

  async deleteFont({ id }: DeleteFontDTO) {
    const prisma = getPrisma()
    const font = await prisma.font.findUnique({ where: { id } })
    if (font) {
      const fullPath = path.join(resolveMediaRoot(), font.filePath)
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    }
    return await prisma.font.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}
