import { app, Menu } from 'electron'
import { APP_ID, APP_NAME } from '../shared/defaults'
import { flushPendingAuthSession, handleAuthCallback, registerProtocol } from './auth'
import { CredentialStore } from './credentials'
import { registerIpc } from './ipc'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { AppStore, applyNativeTheme } from './store'
import {
  createMainWindow,
  setQuitting,
  showMainWindow,
} from './windows'
import { applyAppIcon } from './icon'
import { initPresence } from './presence'

const store = new AppStore()
const credentials = new CredentialStore()

function findProtocolUrl(argv: string[]): string | undefined {
  return argv
    .map((arg) => arg.replace(/^"+|"+$/g, '').trim())
    .find((arg) => arg.includes('tudso://'))
}

async function handleDeepLink(url: string) {
  await credentials.init()
  const normalized = url.replace(/^"+|"+$/g, '').trim()
  if (!normalized.includes('tudso://auth/callback')) return
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return
  }
  const code = parsed.searchParams.get('code')
  const state = parsed.searchParams.get('state')
  if (!code || !state) return
  const session = await handleAuthCallback(code, state, credentials)
  if (session) showMainWindow()
}

app.setName(APP_NAME)
app.setAppUserModelId(APP_ID)
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
registerProtocol()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = findProtocolUrl(argv)
    if (url) void handleDeepLink(url)
    showMainWindow()
  })
}

app.whenReady().then(async () => {
  app.on('open-url', (_event, url) => {
    void handleDeepLink(url)
  })

  await store.init()
  await credentials.init()

  applyNativeTheme(store.getSettings().theme)
  app.setLoginItemSettings({
    openAtLogin: store.getSettings().launchAtStartup,
    enabled: store.getSettings().launchAtStartup,
  })

  const window = createMainWindow(store)
  applyAppIcon()
  window.webContents.on('did-finish-load', () => {
    flushPendingAuthSession()
  })
  registerShortcuts(store.getShortcuts())
  initPresence(store)

  registerIpc(store, credentials)
  Menu.setApplicationMenu(null)

  const startupUrl = findProtocolUrl(process.argv)
  if (startupUrl) await handleDeepLink(startupUrl)
})

app.on('before-quit', () => {
  setQuitting(true)
  unregisterShortcuts()
  void store.flush()
})

app.on('window-all-closed', () => {
  // Stay alive so global shortcuts can restore the hidden window.
})

app.on('activate', () => {
  showMainWindow()
})
