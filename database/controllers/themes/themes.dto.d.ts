export interface CreateThemeDto {
  name: string
  background: string
  textColor: string
  textSize: number
  lineHeight: number
  letterSpacing: number
  fontFamily: string
  textAlign: string
  previewImage: string
}

export interface UpdateThemeDto {
  name?: string
  background?: string
  textColor?: string
  textSize?: number
  lineHeight?: number
  letterSpacing?: number
  fontFamily?: string
  textAlign?: string
  previewImage?: string
}

export interface ThemeResponseDto {
  id: number
  name: string
  background: string
  textColor: string
  textSize: number
  lineHeight: number
  letterSpacing: number
  fontFamily: string
  textAlign: string
  previewImage: string
  createdAt: Date
  updatedAt: Date
}
