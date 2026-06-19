import path from 'path'
import os from 'os'

let userDataPath = path.join(os.homedir(), '.ecclesia')
let downloadsPath = path.join(os.homedir(), 'Downloads')

export function setUserDataPath(p: string): void {
  userDataPath = p
}

export function getUserDataPath(): string {
  return userDataPath
}

export function setDownloadsPath(p: string): void {
  downloadsPath = p
}

export function getDownloadsPath(): string {
  return downloadsPath
}

export function resolveMediaRoot(): string {
  return path.join(getUserDataPath(), 'media')
}

export function resolveFilesRoot(): string {
  return path.join(resolveMediaRoot(), 'files')
}

export function resolveThumbnailsRoot(): string {
  return path.join(resolveMediaRoot(), 'thumbnails')
}

export function resolveFontsRoot(): string {
  return path.join(resolveMediaRoot(), 'fonts')
}

let onFontAddedCallback: (() => void) | null = null
let onMediaChangeCallbackV2: (() => void) | null = null
let onOutboxWriteCallbackV2: (() => void) | null = null

export function setOnFontAddedCallback(fn: () => void): void {
  onFontAddedCallback = fn
}

export function setOnMediaChangeCallback(fn: () => void): void {
  onMediaChangeCallbackV2 = fn
}

export function setOnOutboxWriteCallback(fn: () => void): void {
  onOutboxWriteCallbackV2 = fn
}

export function notifyFontAdded(): void {
  onFontAddedCallback?.()
}

export function notifyFontDeleted(): void {
  onFontAddedCallback?.()
}

export function notifyMediaChanged(): void {
  onMediaChangeCallbackV2?.()
}

export function notifyOutboxWritten(): void {
  onOutboxWriteCallbackV2?.()
}
