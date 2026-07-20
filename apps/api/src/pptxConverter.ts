import fs from 'fs'
// libreoffice-convert uses callback API, promisify it
// eslint-disable-next-line @typescript-eslint/no-require-imports
const libre = require('libreoffice-convert')

export function pptxToPdfBuffer(pptxPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const data = fs.readFileSync(pptxPath)
    libre.convert(data, '.pdf', undefined, (err: NodeJS.ErrnoException | null, result: Buffer) => {
      if (err) {
        reject(new Error(`Error converting PPTX to PDF: ${err.message}. Verify that LibreOffice is installed.`))
      } else {
        resolve(result)
      }
    })
  })
}
