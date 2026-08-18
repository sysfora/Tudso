import { app, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function appIconPath(): string | null {
  const names = process.platform === 'win32' ? ['icon.ico', 'icon.png'] : ['icon.png', 'icon.ico']
  const roots = [
    process.resourcesPath,
    path.join(__dirname, '..', 'public'),
    path.join(__dirname, '..', 'dist'),
    path.join(app.getAppPath(), 'public'),
    path.join(app.getAppPath(), 'dist'),
  ]
  for (const name of names) {
    const match = roots.map((dir) => path.join(dir, name)).find((file) => existsSync(file))
    if (match) return match
  }
  return null
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
