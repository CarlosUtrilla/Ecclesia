import { MediaType } from '@prisma/client'

export interface CreateMediaDto {
  name: string
  type: MediaType
  format: string
  filePath: string
  fileSize: number
  width?: number
  height?: number
  duration?: number
  thumbnail?: string
  folder?: string
}

export interface UpdateMediaDto {
  name?: string
  folder?: string
}

export interface MediaDto {
  id: number
  name: string
  type: MediaType
  format: string
  filePath: string
  fileSize: number
  width?: number | null
  height?: number | null
  duration?: number | null
  thumbnail?: string | null
  folder?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MediaListDto {
  items: MediaDto[]
  total: number
}

export interface MediaFilterDto {
  type?: MediaType
  search?: string
  page?: number
  limit?: number
}
