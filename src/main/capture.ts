import { desktopCapturer, screen } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { getMainWindow, restoreTaskbarPresence, showMainWindow } from './windows'

export async function captureScreen(): Promise<string | null> {
  try {
    const primary = screen.getPrimaryDisplay()
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: primary.size.width, height: primary.size.height },
    })
    restoreTaskbarPresence()
    const source = sources[0]
    if (!source) return null
    return source.thumbnail.toDataURL()
  } catch {
    restoreTaskbarPresence()
    return null
  }
}

export async function captureScreenWithoutApp(): Promise<string | null> {
  const image = await captureScreen()
  const win = getMainWindow()
  if (image && win && !win.isDestroyed() && !win.isVisible()) showMainWindow()
  return image
}

export async function captureActiveWindow(): Promise<string | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1920, height: 1080 },
    })
    restoreTaskbarPresence()
    const source = sources[0]
    if (!source) return null
    return source.thumbnail.toDataURL()
  } catch {
    restoreTaskbarPresence()
    return null
  }
}

export async function captureRegion(): Promise<string | null> {
  const { selectRegion } = await import('./region-window')
  return selectRegion()
}

export async function saveCapture(dataUrl: string): Promise<string> {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  const filePath = join(tmpdir(), `tudso-capture-${randomUUID()}.png`)
  await writeFile(filePath, Buffer.from(base64, 'base64'))
  return filePath
}
