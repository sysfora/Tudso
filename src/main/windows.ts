import { BrowserWindow, nativeTheme, screen, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHANNELS } from '../shared/channels'
import { DEFAULT_BOUNDS, WINDOW_SIZES } from '../shared/defaults'
import type { ThemeMode, WindowBounds, WindowMode } from '../shared/types'
import { appIconPath, loadAppIcon } from './icon'
import type { AppStore } from './store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TITLEBAR_HEIGHT = 56
const MIN_WIDTH = 400
const MIN_HEIGHT = 480

let win: BrowserWindow | null = null
let boundsTimer: ReturnType<typeof setTimeout> | null = null
let quitting = false
let collapsed = false
let expandedHeight = DEFAULT_BOUNDS.height
let skipTaskbar = false
let alwaysOnTopTimer: ReturnType<typeof setInterval> | null = null

export function getMainWindow() {
  return win
}

export function setQuitting(value: boolean) {
  quitting = value
}

export function chromeColor(theme: ThemeMode) {
  const dark = theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors)
  return dark ? '#1c1c1f' : '#f4f4f5'
}

export function applyWindowChrome(theme: ThemeMode, transparency = false) {
  if (!win || win.isDestroyed()) return
  win.setBackgroundColor(transparency ? '#00000000' : chromeColor(theme))
}

export function createMainWindow(store: AppStore) {
  const settings = store.getSettings()
  const saved = store.getBounds()
  const width = settings.rememberSize && saved ? saved.width : DEFAULT_BOUNDS.width
  const height = settings.rememberSize && saved ? saved.height : DEFAULT_BOUNDS.height
  const restored = settings.rememberPosition && saved ? clampToDisplay(saved) : null

  win = new BrowserWindow({
    width,
    height,
    x: restored?.x,
    y: restored?.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: settings.transparency ? '#00000000' : chromeColor(settings.theme),
    hasShadow: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: appIconPath() ?? undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  if (!restored) win.center()
  const icon = loadAppIcon()
  if (icon) win.setIcon(icon)
  applyFloatingChrome()
  applyWindowChrome(settings.theme, settings.transparency)
  setHideFromCapture(settings.hideFromCapture)

  const session = win.webContents.session
  session.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'media' || permission === 'display-capture' || permission === 'clipboard-sanitized-write')
  })
  session.setPermissionCheckHandler((_contents, permission) => {
    return permission === 'media' || permission === 'clipboard-sanitized-write'
  })

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
    startAlwaysOnTopGuard()
  })
  win.on('hide', () => stopAlwaysOnTopGuard())
  win.on('blur', () => {
    if (!win?.isVisible()) return
    pinAboveFullscreen()
  })
  screen.on('display-metrics-changed', () => {
    if (!win || win.isDestroyed() || !win.isVisible()) return
    pinAboveFullscreen()
  })

  win.once('ready-to-show', () => {
    if (!settings.startMinimized) win?.show()
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
  win.show()
  win.focus()
}

export function hideMainWindow() {
  if (!win || win.isDestroyed()) return
  win.hide()
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
}

function applyFloatingChrome() {
  if (!win || win.isDestroyed()) return
  win.setSkipTaskbar(skipTaskbar)
  pinAboveFullscreen()
  if (win.isVisible()) startAlwaysOnTopGuard()
}

function pinAboveFullscreen() {
  if (!win || win.isDestroyed()) return
  try {
    win.setAlwaysOnTop(true, 'screen-saver', 1)
  } catch {
    try {
      win.setAlwaysOnTop(true, 'screen-saver')
    } catch {
      win.setAlwaysOnTop(true)
    }
  }
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } catch {
    undefined
  }
}

function startAlwaysOnTopGuard() {
  if (alwaysOnTopTimer) return
  alwaysOnTopTimer = setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible()) return
    pinAboveFullscreen()
  }, 400)
}

function stopAlwaysOnTopGuard() {
  if (!alwaysOnTopTimer) return
  clearInterval(alwaysOnTopTimer)
  alwaysOnTopTimer = null
}

export function setSkipTaskbar(skip: boolean) {
  skipTaskbar = skip
  if (!win || win.isDestroyed()) return
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
  const wasVisible = win.isVisible()

  if (collapsed) {
    const x = Math.round(bounds.x + (bounds.width - size.width) / 2)
    const next = clampToDisplay({ x, y: bounds.y, width: size.width, height: TITLEBAR_HEIGHT }, display.workArea)
    win.setBounds({ ...next, height: TITLEBAR_HEIGHT }, wasVisible)
    if (!wasVisible && win.isVisible()) win.hide()
    return
  }

  const x = Math.round(bounds.x + (bounds.width - size.width) / 2)
  const y = Math.round(bounds.y + (bounds.height - size.height) / 2)
  const next = clampToDisplay({ x, y, width: size.width, height: size.height }, display.workArea)
  win.setBounds(next, wasVisible)
  if (!wasVisible && win.isVisible()) win.hide()
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
  const wasVisible = win.isVisible()
  win.setPosition(next.x, next.y, wasVisible)
  if (!wasVisible && win.isVisible()) win.hide()
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
