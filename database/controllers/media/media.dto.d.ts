import { Media, MediaType } from '@prisma/client'

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
  fallback?: string
  folder?: string
}

export interface UpdateMediaDto {
  name?: string
  filePath?: string
  folder?: string | null
}

export type MediaDto = Media

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
