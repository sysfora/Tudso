import { desktopCapturer, screen, systemPreferences } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { withPreservedForeground } from './overlay'
import { isMac } from './platform'
import { excludeWindowFromCapture, getMainWindow, restoreOverlayAfterCapture, restoreWindowAfterCapture } from './windows'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function captureThumbnailSize() {
  const point = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(point)
  const scale = display.scaleFactor || 1
  return {
    display,
    width: Math.max(1, Math.round(display.size.width * scale)),
    height: Math.max(1, Math.round(display.size.height * scale)),
  }
}

export async function ensureCaptureAccess() {
  if (!isMac) return
  try {
    const mic = systemPreferences.getMediaAccessStatus('microphone')
    if (mic !== 'granted') await systemPreferences.askForMediaAccess('microphone')
  } catch {
    undefined
  }
}

async function captureScreenRaw(): Promise<string | null> {
  try {
    await ensureCaptureAccess()
    const { display, width, height } = captureThumbnailSize()
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    })
    restoreOverlayAfterCapture()
    const source =
      sources.find((item) => item.display_id && item.display_id === String(display.id)) ?? sources[0]
    if (!source) return null
    return source.thumbnail.toDataURL()
  } catch {
    restoreOverlayAfterCapture()
    return null
  }
}

export async function captureScreen(): Promise<string | null> {
  return withPreservedForeground(captureScreenRaw, getMainWindow())
}

export async function captureScreenWithoutApp(keepExcluded = false): Promise<string | null> {
  return withPreservedForeground(async () => {
    excludeWindowFromCapture(keepExcluded)
    await delay(50)
    try {
      return await captureScreenRaw()
    } finally {
      restoreWindowAfterCapture()
    }
  }, getMainWindow())
}

export async function captureActiveWindow(): Promise<string | null> {
  return withPreservedForeground(async () => {
    try {
      await ensureCaptureAccess()
      const { width, height } = captureThumbnailSize()
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width, height },
      })
      restoreOverlayAfterCapture()
      const source = sources[0]
      if (!source) return null
      return source.thumbnail.toDataURL()
    } catch {
      restoreOverlayAfterCapture()
      return null
    }
  }, getMainWindow())
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
