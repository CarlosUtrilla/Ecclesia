import { app } from 'electron'
import * as path from 'path'

export function getBiblesResourcesPath(): string {
  const pkg = app.isPackaged
  return pkg
    ? path.join(process.resourcesPath, 'bibles')
    : path.join(__dirname, '../../resources/bibles')
}
