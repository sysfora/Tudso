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

let captureAccessRequest: Promise<void> | null = null
let captureAccessState: 'unknown' | 'granted' | 'denied' = 'unknown'
let screenCapturePermissionState: 'unknown' | 'granted' | 'denied' = 'unknown'

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
  if (captureAccessState === 'granted' || captureAccessState === 'denied') return
  if (captureAccessRequest) {
    await captureAccessRequest
    return
  }

  captureAccessRequest = (async () => {
    try {
      const mic = systemPreferences.getMediaAccessStatus('microphone')
      if (mic === 'granted') {
        captureAccessState = 'granted'
        return
      }
      if (mic === 'denied') {
        captureAccessState = 'denied'
        return
      }
      await systemPreferences.askForMediaAccess('microphone')
      const next = systemPreferences.getMediaAccessStatus('microphone')
      captureAccessState = next === 'granted' ? 'granted' : 'denied'
    } catch {
      captureAccessState = 'denied'
    } finally {
      captureAccessRequest = null
    }
  })()

  await captureAccessRequest
}

async function ensureScreenCapturePermission(): Promise<boolean> {
  if (process.platform !== 'linux') return true
  if (screenCapturePermissionState === 'granted') return true
  if (screenCapturePermissionState === 'denied') return false

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 },
    })
    screenCapturePermissionState = sources.length > 0 ? 'granted' : 'denied'
    return screenCapturePermissionState === 'granted'
  } catch {
    screenCapturePermissionState = 'denied'
    return false
  }
}

async function captureScreenRaw(): Promise<string | null> {
  try {
    await ensureCaptureAccess()
    if (process.platform === 'linux' && !(await ensureScreenCapturePermission())) {
      restoreOverlayAfterCapture()
      return null
    }
    const { display, width, height } = captureThumbnailSize()
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    })
    if (sources.length > 0) {
      captureAccessState = 'granted'
      screenCapturePermissionState = 'granted'
    }
    restoreOverlayAfterCapture()
    const source =
      sources.find((item) => item.display_id && item.display_id === String(display.id)) ?? sources[0]
    if (!source) return null
    return source.thumbnail.toDataURL()
  } catch {
    screenCapturePermissionState = 'denied'
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
      if (sources.length > 0) captureAccessState = 'granted'
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
