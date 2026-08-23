import { app, nativeImage, type BrowserWindow, type NativeImage } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMac } from './platform'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function iconRoots() {
  const roots = [
    process.resourcesPath,
    path.join(process.resourcesPath ?? '', 'resources'),
    path.join(__dirname, '..', 'public'),
    path.join(__dirname, '..', 'server', 'public'),
    path.join(__dirname, '..', 'dist'),
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'server', 'public'),
  ]
  try {
    roots.push(path.join(app.getAppPath(), 'public'))
    roots.push(path.join(app.getAppPath(), 'server', 'public'))
    roots.push(path.join(app.getAppPath(), 'dist'))
  } catch {
    undefined
  }
  return roots
}

function iconCandidates() {
  const files: string[] = []
  const seen = new Set<string>()
  for (const name of ['icon.png', 'icon.ico']) {
    for (const dir of iconRoots()) {
      const file = path.join(dir, name)
      if (!existsSync(file) || seen.has(file)) continue
      seen.add(file)
      files.push(file)
    }
  }
  return files
}

function loadAppIconSource() {
  for (const file of iconCandidates()) {
    const image = nativeImage.createFromPath(file)
    if (image.isEmpty()) continue
    return { path: file, image }
  }
  return null
}

export function appIconPath(): string | null {
  return loadAppIconSource()?.path ?? null
}

export function loadAppIcon(): NativeImage | undefined {
  return loadAppIconSource()?.image
}

export function loadTrayIcon(): NativeImage {
  const source = loadAppIcon()
  if (!source) return nativeImage.createEmpty()
  const size = isMac ? 22 : 32
  return source.resize({ width: size, height: size, quality: 'best' })
}

export function applyWindowIcon(win: BrowserWindow | null | undefined) {
  if (!win || win.isDestroyed()) return
  const icon = loadAppIcon()
  if (!icon) return
  try {
    win.setIcon(icon)
  } catch {
    undefined
  }
}

export function refreshWindowIcon(win: BrowserWindow | null | undefined) {
  applyWindowIcon(win)
  setTimeout(() => applyWindowIcon(win), 0)
  setTimeout(() => applyWindowIcon(win), 50)
  setTimeout(() => applyWindowIcon(win), 250)
}

export function applyAppIcon() {
  const icon = loadAppIcon()
  if (!icon) return
  if (isMac && app.dock) app.dock.setIcon(icon)
}
