export interface AddFontDTO {
  name: string
  fileName: string
  filePath: string
}

export interface DeleteFontDTO {
  id: number
}

export interface FontDTO {
  id: number
  name: string
  fileName: string
  filePath: string
  createdAt: Date
}
