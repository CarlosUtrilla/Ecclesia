export type UploadPlan = {
  toUpload: string[]
  skippedDuplicates: string[]
}

export function planFontUploads(selectedFileNames: string[], existingFileNames: string[]): UploadPlan {
  const existing = new Set(existingFileNames.map((name) => name.trim().toLowerCase()))
  const seenInBatch = new Set<string>()

  const toUpload: string[] = []
  const skippedDuplicates: string[] = []

  for (const fileName of selectedFileNames) {
    const key = fileName.trim().toLowerCase()
    if (!key) continue

    if (existing.has(key) || seenInBatch.has(key)) {
      skippedDuplicates.push(fileName)
      continue
    }

    seenInBatch.add(key)
    toUpload.push(fileName)
  }

  return { toUpload, skippedDuplicates }
}
