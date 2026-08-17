import { app, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function appIconPath(): string | null {
  const candidates = [
    path.join(process.resourcesPath, 'icon.png'),
    path.join(__dirname, '../public/icon.png'),
    path.join(__dirname, '../dist/icon.png'),
    path.join(app.getAppPath(), 'public/icon.png'),
    path.join(app.getAppPath(), 'dist/icon.png'),
  ]
  return candidates.find((file) => existsSync(file)) ?? null
}

export function loadAppIcon(): NativeImage | undefined {
  const file = appIconPath()
  if (!file) return undefined
  const icon = nativeImage.createFromPath(file)
  return icon.isEmpty() ? undefined : icon
}

export function loadTrayIcon(): NativeImage {
  const source = loadAppIcon()
  if (!source) return nativeImage.createEmpty()
  const size = process.platform === 'darwin' ? 22 : 32
  return source.resize({ width: size, height: size, quality: 'best' })
}

export function applyAppIcon() {
  const icon = loadAppIcon()
  if (!icon) return
  if (process.platform === 'darwin' && app.dock) app.dock.setIcon(icon)
}
