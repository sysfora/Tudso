import { BrowserWindow, ipcMain, screen } from 'electron'
import sharp from 'sharp'
import { captureScreen } from './capture'
import { isMac } from './platform'
import type { WindowBounds } from '../shared/types'

let overlay: BrowserWindow | null = null

const overlayHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { cursor: crosshair; overflow: hidden; background: rgba(0,0,0,0.2); }
    #hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); color: white; font: 14px sans-serif; pointer-events: none; }
    #rect { position: fixed; border: 2px solid #5b5fee; background: rgba(91,95,238,0.15); pointer-events: none; display: none; }
  </style>
</head>
<body>
  <div id="hint">Drag to select a region. Press Escape to cancel.</div>
  <div id="rect"></div>
  <script>
    const { ipcRenderer } = require('electron')
    let start = null
    let current = null
    const rect = document.getElementById('rect')
    document.addEventListener('mousedown', (e) => { start = { x: e.clientX, y: e.clientY }; current = start; rect.style.display = 'block'; update(); })
    document.addEventListener('mousemove', (e) => { if (!start) return; current = { x: e.clientX, y: e.clientY }; update(); })
    document.addEventListener('mouseup', () => { if (start && current) { ipcRenderer.send('region:select', { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y), width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y) }); } start = null; current = null; })
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ipcRenderer.send('region:cancel'); })
    function update() {
      if (!start || !current) return
      rect.style.left = Math.min(start.x, current.x) + 'px'
      rect.style.top = Math.min(start.y, current.y) + 'px'
      rect.style.width = Math.abs(current.x - start.x) + 'px'
      rect.style.height = Math.abs(current.y - start.y) + 'px'
    }
  </script>
</body>
</html>`

export function selectRegion(): Promise<string | null> {
  return new Promise((resolve) => {
    if (overlay) {
      overlay.close()
      overlay = null
    }

    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    overlay = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      fullscreen: false,
      simpleFullscreen: false,
      frame: false,
      transparent: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      enableLargerThanScreen: true,
      acceptFirstMouse: true,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
    })

    try {
      if (isMac) overlay.setAlwaysOnTop(true, 'screen-saver')
      else overlay.setAlwaysOnTop(true)
      overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    } catch {
      undefined
    }

    overlay.setIgnoreMouseEvents(false)
    overlay.loadURL(`data:text/html;base64,${Buffer.from(overlayHtml).toString('base64')}`)
    overlay.setFocusable(true)
    overlay.focus()

    const scale = display.scaleFactor || 1
    const cleanup = async (bounds: WindowBounds | null) => {
      overlay?.close()
      overlay = null
      if (!bounds || bounds.width < 2 || bounds.height < 2) {
        resolve(null)
        return
      }
      const full = await captureScreen()
      if (!full) {
        resolve(null)
        return
      }
      try {
        const cropped = await cropImage(full, {
          x: Math.round(bounds.x * scale),
          y: Math.round(bounds.y * scale),
          width: Math.round(bounds.width * scale),
          height: Math.round(bounds.height * scale),
        })
        resolve(cropped)
      } catch {
        resolve(null)
      }
    }

    const onSelect = (_event: unknown, bounds: WindowBounds) => cleanup(bounds)
    const onCancel = () => cleanup(null)

    ipcMain.once('region:select', onSelect)
    ipcMain.once('region:cancel', onCancel)

    overlay.on('closed', () => {
      ipcMain.removeListener('region:select', onSelect)
      ipcMain.removeListener('region:cancel', onCancel)
      overlay = null
    })
  })
}

async function cropImage(dataUrl: string, bounds: WindowBounds): Promise<string> {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  const image = sharp(buffer)
  const meta = await image.metadata()
  const maxWidth = meta.width ?? bounds.width
  const maxHeight = meta.height ?? bounds.height
  const left = Math.min(Math.max(0, bounds.x), Math.max(0, maxWidth - 1))
  const top = Math.min(Math.max(0, bounds.y), Math.max(0, maxHeight - 1))
  const width = Math.min(Math.max(1, bounds.width), Math.max(1, maxWidth - left))
  const height = Math.min(Math.max(1, bounds.height), Math.max(1, maxHeight - top))
  const cropped = await image.extract({ left, top, width, height }).png().toBuffer()
  return `data:image/png;base64,${cropped.toString('base64')}`
}
