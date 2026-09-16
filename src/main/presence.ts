import { app } from 'electron'
import type { AppStore } from './store'
import { createTray, destroyTray } from './tray'
import { getMainWindow, isFloatingEnabled, setFloatingEnabled, setQuitting, setSkipTaskbar, showMainWindow } from './windows'

let storeRef: AppStore | null = null
let signedInReady = false
let trayRefresh: (() => void) | null = null
export function initPresence(store: AppStore) {
  storeRef = store
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.on('hide', () => applyPresence())
    win.on('show', () => applyPresence())
  }
  applyPresence()
}

export function setSignedInReady(ready: boolean) {
  signedInReady = ready
  applyPresence()
}

export function applyPresence() {
  if (!storeRef) return
  const settings = storeRef.getSettings()
  const overlay = signedInReady && !settings.showInTaskbar
  const wasFloating = isFloatingEnabled()
  setSkipTaskbar(overlay)
  setFloatingEnabled(overlay)
  if (wasFloating && !overlay) showMainWindow()

  const win = getMainWindow()
  const hidden = !win || win.isDestroyed() || !win.isVisible()
  const showTray = signedInReady && (settings.showInTray || (settings.minimizeToTray && hidden))

  if (process.platform === 'darwin' && app.dock) {
    if (signedInReady) app.dock.show()
    else app.dock.hide()
  }

  if (showTray) {
    const tray = createTray(
      () => {
        setQuitting(true)
        app.quit()
      },
    )
    trayRefresh = tray.refresh
    return
  }

  destroyTray()
  trayRefresh = null
}

export function refreshTray() {
  trayRefresh?.()
}
