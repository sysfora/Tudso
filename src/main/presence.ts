import { app } from 'electron'
import { CHANNELS } from '../shared/channels'
import type { AppStore } from './store'
import { createTray, destroyTray } from './tray'
import { sendToRenderer, getMainWindow, setFloatingEnabled, setHideFromCapture, setQuitting, setSkipTaskbar } from './windows'

let storeRef: AppStore | null = null
let signedInReady = false
let trayRefresh: (() => void) | null = null
let hideFromCaptureAllowed = false

export function isHideFromCaptureAllowed() {
  return hideFromCaptureAllowed
}

export async function setHideFromCaptureAllowed(allowed: boolean, store: AppStore) {
  hideFromCaptureAllowed = allowed
  if (!allowed) {
    const previous = store.getSettings()
    if (previous.hideFromCapture) {
      const next = store.setSettings({ hideFromCapture: false })
      setHideFromCapture(false)
      sendToRenderer(CHANNELS.settingsChanged, next)
    }
  }
  refreshTray()
}

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
  setFloatingEnabled(ready)
  applyPresence()
}

export function applyPresence() {
  if (!storeRef) return
  const settings = storeRef.getSettings()
  const showTaskbar = !signedInReady || settings.showInTaskbar
  setSkipTaskbar(!showTaskbar)

  const win = getMainWindow()
  const hidden = !win || win.isDestroyed() || !win.isVisible()
  const showTray = signedInReady && (settings.showInTray || (settings.minimizeToTray && hidden))

  if (showTray) {
    const tray = createTray(
      () => storeRef!.getSettings(),
      () => hideFromCaptureAllowed,
      (value) => {
        if (!hideFromCaptureAllowed) return
        const next = storeRef!.setSettings({ hideFromCapture: value })
        setHideFromCapture(value)
        sendToRenderer(CHANNELS.settingsChanged, next)
      },
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
