import { BrowserWindow, screen, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHANNELS } from '../shared/channels'
import { DEFAULT_BOUNDS, WINDOW_SIZES } from '../shared/defaults'
import type { ThemeMode, WindowBounds, WindowMode, WindowResizeEdge } from '../shared/types'
import { appIconPath, applyWindowIcon, refreshWindowIcon } from './icon'
import {
  applyOverlayWindowStyle,
  applyNativeRoundedCorners,
  clearOverlayWindowStyle,
  ensureNoActivate,
  raiseFloatingWindow,
  setWindowBoundsNoActivate,
  setWindowPositionNoActivate,
  showWithoutActivating,
  startOverlayKeyboard,
  setWindowChromeRestorer,
} from './overlay'
import { isMac, usesNativeOverlay } from './platform'
import type { AppStore } from './store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TITLEBAR_HEIGHT = 58
const MIN_WIDTH = 400
const MIN_HEIGHT = 480

let win: BrowserWindow | null = null
let boundsTimer: ReturnType<typeof setTimeout> | null = null
let quitting = false
let collapsed = false
let expandedHeight = DEFAULT_BOUNDS.height
let skipTaskbar = false
let floatingEnabled = false
let resizeSession: { edge: WindowResizeEdge; x: number; y: number; bounds: WindowBounds } | null = null

export function getMainWindow() {
  return win
}

export function setQuitting(value: boolean) {
  quitting = value
}

export function applyWindowChrome(_theme: ThemeMode, _transparency = false) {
  if (!win || win.isDestroyed()) return
  win.setBackgroundColor('#00000000')
}

export function createMainWindow(store: AppStore) {
  const settings = store.getSettings()
  const saved = store.getBounds()
  const width = settings.rememberSize && saved ? saved.width : DEFAULT_BOUNDS.width
  const height = settings.rememberSize && saved ? saved.height : DEFAULT_BOUNDS.height
  const display = screen.getPrimaryDisplay()
  const workArea = display.workArea
  const centered = {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  }

  win = new BrowserWindow({
    width,
    height,
    x: centered.x,
    y: centered.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    focusable: true,
    acceptFirstMouse: true,
    ...(isMac ? { roundedCorners: true } : {}),
    icon: appIconPath() ?? undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  setWindowChromeRestorer(() => applyFloatingChrome())

  win.setBounds(centered, false)
  applyWindowIcon(win)
  applyFloatingChrome()
  applyWindowChrome(settings.theme, settings.transparency)
  applyNativeRoundedCorners(win)
  setHideFromCapture(settings.hideFromCapture)

  const session = win.webContents.session
  const allowedPermissions = new Set(['media', 'display-capture', 'clipboard-sanitized-write', 'fullscreen'])
  session.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(allowedPermissions.has(permission))
  })
  session.setPermissionCheckHandler((_contents, permission) => allowedPermissions.has(permission))

  win.webContents.setBackgroundThrottling(false)
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const current = win?.webContents.getURL()
    if (current && url !== current) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      win?.hide()
    }
  })

  win.on('minimize', () => {
    if (!win || win.isDestroyed()) return
    if (!floatingEnabled) return
    if (store.getSettings().minimizeToTray) {
      win.restore()
      win.hide()
      return
    }
    win.restore()
    collapseMainWindow()
  })

  win.webContents.on('did-finish-load', () => {
    sendToRenderer(CHANNELS.windowCollapsed, collapsed)
  })

  const persistBounds = () => {
    if (!win || win.isDestroyed()) return
    const bounds = win.getBounds()
    store.setBounds({
      ...bounds,
      height: collapsed ? expandedHeight : bounds.height,
    })
  }

  win.on('move', () => debounceBounds(persistBounds))
  win.on('resize', () => debounceBounds(persistBounds))

  win.on('show', () => {
    applyFloatingChrome()
    if (!win || win.isDestroyed()) return
    applyNativeRoundedCorners(win)
  })
  win.on('blur', () => {
    if (!floatingEnabled || !win?.isVisible()) return
    if (usesNativeOverlay()) {
      ensureNoActivate(win)
      return
    }
    raiseFloatingWindow(win)
  })
  screen.on('display-metrics-changed', () => {
    if (!floatingEnabled || !win || win.isDestroyed() || !win.isVisible()) return
    applyOverlayWindowStyle(win)
  })

  win.once('ready-to-show', () => {
    if (settings.startMinimized) return
    const current = getMainWindow()
    if (!current || current.isDestroyed()) return
    if (!current.isVisible()) {
      if (floatingEnabled) showMainWindow()
      else current.show()
    }
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) void win.loadURL(rendererUrl)
  else void win.loadFile(path.join(__dirname, '../dist/index.html'))

  return win
}

export function toggleMainWindow() {
  if (!win || win.isDestroyed()) return
  if (win.isVisible()) {
    win.hide()
    return
  }
  showMainWindow()
}

export function showMainWindow() {
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  applyFloatingChrome()
  if (floatingEnabled && usesNativeOverlay()) {
    showWithoutActivating(win)
    return
  }
  if (floatingEnabled) {
    showWithoutActivating(win)
    raiseFloatingWindow(win)
    win.focus()
    return
  }
  win.show()
  win.focus()
  refreshWindowIcon(win)
}

export function hideMainWindow() {
  if (!win || win.isDestroyed()) return
  win.hide()
}

export function minimizeMainWindow(toTray = false) {
  if (!win || win.isDestroyed()) return
  if (collapsed) {
    expandMainWindow()
    return
  }
  if (!floatingEnabled) {
    win.minimize()
    return
  }
  if (toTray) hideMainWindow()
  else collapseMainWindow()
}

export function isWindowCollapsed() {
  return collapsed
}

export function toggleCollapsed() {
  if (collapsed) expandMainWindow()
  else collapseMainWindow()
}

export function collapseMainWindow() {
  if (!win || win.isDestroyed() || collapsed) return
  const bounds = win.getBounds()
  expandedHeight = Math.max(bounds.height, MIN_HEIGHT)
  collapsed = true
  const workArea = screen.getDisplayMatching(bounds).workArea
  win.setMinimumSize(MIN_WIDTH, TITLEBAR_HEIGHT)
  win.setMaximumSize(workArea.width, TITLEBAR_HEIGHT)
  win.setSize(bounds.width, TITLEBAR_HEIGHT)
  applyFloatingChrome()
  sendToRenderer(CHANNELS.windowCollapsed, true)
}

export function expandMainWindow() {
  if (!win || win.isDestroyed() || !collapsed) return
  collapsed = false
  const bounds = win.getBounds()
  const workArea = screen.getDisplayMatching(bounds).workArea
  win.setMaximumSize(workArea.width, workArea.height)
  win.setMinimumSize(MIN_WIDTH, MIN_HEIGHT)
  win.setSize(bounds.width, Math.min(expandedHeight, workArea.height))
  applyFloatingChrome()
  sendToRenderer(CHANNELS.windowCollapsed, false)
}

export function restoreTaskbarPresence() {
  if (!win || win.isDestroyed()) return
  const apply = () => {
    if (!win || win.isDestroyed()) return
    applyFloatingChrome()
    try {
      if (win.isFullScreen()) win.setFullScreen(false)
      win.setSimpleFullScreen(false)
    } catch {
      undefined
    }
  }
  apply()
  setTimeout(apply, 50)
  setTimeout(apply, 250)
  refreshWindowIcon(win)
}

export function restoreOverlayAfterCapture() {
  if (!win || win.isDestroyed()) return
  if (floatingEnabled) {
    applyOverlayWindowStyle(win)
    return
  }
  restoreTaskbarPresence()
}

let capturePark: { protect: boolean } | null = null

export function excludeWindowFromCapture(keepExcluded: boolean) {
  if (!win || win.isDestroyed()) return false
  capturePark = { protect: keepExcluded }
  try {
    win.setContentProtection(true)
  } catch {
    undefined
  }
  return true
}

export function restoreWindowAfterCapture() {
  if (!win || win.isDestroyed()) {
    capturePark = null
    return
  }
  const parked = capturePark
  capturePark = null
  if (parked) {
    try {
      win.setContentProtection(parked.protect)
    } catch {
      undefined
    }
  }
  restoreOverlayAfterCapture()
}

function applyFloatingChrome() {
  if (!win || win.isDestroyed()) return
  if (floatingEnabled) {
    startOverlayKeyboard(win)
    applyOverlayWindowStyle(win)
    return
  }
  clearOverlayWindowStyle(win)
  win.setSkipTaskbar(skipTaskbar)
  refreshWindowIcon(win)
}

export function setFloatingEnabled(enabled: boolean) {
  floatingEnabled = enabled
  applyFloatingChrome()
}

export function isFloatingEnabled() {
  return floatingEnabled
}

export function setSkipTaskbar(skip: boolean) {
  skipTaskbar = skip
  if (!win || win.isDestroyed() || floatingEnabled) return
  win.setSkipTaskbar(skip)
}

export function setAlwaysOnTop(_value?: boolean) {
  applyFloatingChrome()
  return true
}

export function setHideFromCapture(value: boolean) {
  if (!win || win.isDestroyed()) return false
  try {
    win.setContentProtection(value)
  } catch {
    return false
  }
  return value
}

export function setWindowMode(mode: WindowMode) {
  if (!win || win.isDestroyed()) return
  const size = WINDOW_SIZES[mode]
  const bounds = win.getBounds()
  const display = screen.getDisplayMatching(bounds)
  expandedHeight = size.height

  if (collapsed) {
    const x = Math.round(bounds.x + (bounds.width - size.width) / 2)
    const next = clampToDisplay({ x, y: bounds.y, width: size.width, height: TITLEBAR_HEIGHT }, display.workArea)
    setWindowBoundsNoActivate(win, { ...next, height: TITLEBAR_HEIGHT })
    return
  }

  const x = Math.round(bounds.x + (bounds.width - size.width) / 2)
  const y = Math.round(bounds.y + (bounds.height - size.height) / 2)
  const next = clampToDisplay({ x, y, width: size.width, height: size.height }, display.workArea)
  setWindowBoundsNoActivate(win, next)
}

export function beginWindowResize(edge: WindowResizeEdge, x: number, y: number) {
  if (!win || win.isDestroyed() || collapsed) return
  resizeSession = { edge, x, y, bounds: win.getBounds() }
}

export function resizeWindow(x: number, y: number) {
  if (!win || win.isDestroyed() || !resizeSession) return
  const { edge, x: startX, y: startY, bounds: start } = resizeSession
  const dx = x - startX
  const dy = y - startY
  const next = { ...start }

  if (edge.includes('e')) next.width = start.width + dx
  if (edge.includes('w')) {
    next.x = start.x + dx
    next.width = start.width - dx
  }
  if (edge.includes('s')) next.height = start.height + dy
  if (edge.includes('n')) {
    next.y = start.y + dy
    next.height = start.height - dy
  }

  if (next.width < MIN_WIDTH) {
    if (edge.includes('w')) next.x = start.x + (start.width - MIN_WIDTH)
    next.width = MIN_WIDTH
  }
  if (next.height < MIN_HEIGHT) {
    if (edge.includes('n')) next.y = start.y + (start.height - MIN_HEIGHT)
    next.height = MIN_HEIGHT
  }

  const display = screen.getDisplayMatching(start)
  setWindowBoundsNoActivate(win, clampToDisplay(next, display.workArea))
}

export function endWindowResize() {
  resizeSession = null
}

export function getWindowBounds(): WindowBounds | null {
  if (!win || win.isDestroyed()) return null
  return win.getBounds()
}

export function moveMainWindow(position: { x: number; y: number }) {
  if (!win || win.isDestroyed()) return
  const bounds = win.getBounds()
  const display = screen.getDisplayMatching(bounds)
  const next = clampToDisplay({ ...bounds, x: position.x, y: position.y }, display.workArea)
  setWindowPositionNoActivate(win, next.x, next.y)
}

export function sendToRenderer(channel: string, payload?: unknown) {
  if (!win || win.isDestroyed()) return
  win.webContents.send(channel, payload)
}

function debounceBounds(fn: () => void) {
  if (boundsTimer) clearTimeout(boundsTimer)
  boundsTimer = setTimeout(fn, 280)
}

function clampToDisplay(bounds: WindowBounds, workArea = screen.getDisplayMatching(bounds).workArea): WindowBounds {
  const minHeight = collapsed ? TITLEBAR_HEIGHT : MIN_HEIGHT
  const width = Math.min(Math.max(bounds.width, MIN_WIDTH), workArea.width)
  const height = Math.min(Math.max(bounds.height, minHeight), workArea.height)
  const x = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width)
  const y = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height)
  return { x, y, width, height }
}
