import { app, dialog, ipcMain, shell } from 'electron'
import { CHANNELS } from '../shared/channels'
import type {
  AuthSession,
  ChatRequest,
  Conversation,
  PickedFile,
  Settings,
  ShortcutId,
} from '../shared/types'
import { clearSession, getSession, openLogin, setSession, startLogin } from './auth'
import { generateResponse } from './ai'
import { getAudioSources, startAudioCapture, stopAudioCapture } from './audio-capture'
import { captureActiveWindow, captureRegion, captureScreenWithoutApp } from './capture'
import type { CredentialStore } from './credentials'
import { notifyIfUnfocused, showNotification } from './notifications'
import { DEFAULT_SHORTCUTS, normalizeShortcutMap } from '../shared/defaults'
import {
  getFailedShortcutIds,
  isAcceleratorTakenByOtherApp,
  registerShortcuts,
  SHORTCUT_TAKEN_MESSAGE,
  suspendShortcuts,
} from './shortcuts'
import { type AppStore, applyNativeTheme } from './store'
import { applyPresence, refreshTray, setSignedInReady } from './presence'
import { moveToPreset, nudgeWindow } from './window-position'
import {
  applyWindowChrome,
  getMainWindow,
  getWindowBounds,
  isWindowCollapsed,
  hideMainWindow,
  moveMainWindow,
  restoreTaskbarPresence,
  sendToRenderer,
  setAlwaysOnTop,
  setHideFromCapture,
  setWindowMode,
  toggleCollapsed,
} from './windows'

let abortController: AbortController | null = null
let locked = false

export function registerIpc(store: AppStore, credentials: CredentialStore) {
  locked = store.getSettings().lockEnabled && credentials.hasPin()

  ipcMain.handle(CHANNELS.authStartLogin, async () => {
    const deviceId = `desktop-${Date.now()}`
    return startLogin(deviceId, process.platform, app.getVersion())
  })
  ipcMain.handle(CHANNELS.authOpenLogin, async (_event, url: string) => openLogin(url))
  ipcMain.handle(CHANNELS.authSetSession, async (_event, session: AuthSession) => setSession(session, credentials))
  ipcMain.handle(CHANNELS.authGetSession, async () => getSession(credentials))
  ipcMain.handle(CHANNELS.authClearSession, async () => clearSession(credentials))

  ipcMain.on(CHANNELS.windowMinimize, () => {
    if (isWindowCollapsed()) {
      toggleCollapsed()
      return
    }
    if (store.getSettings().minimizeToTray) hideMainWindow()
    else toggleCollapsed()
  })
  ipcMain.on(CHANNELS.windowClose, () => hideMainWindow())
  ipcMain.on(CHANNELS.windowHide, () => hideMainWindow())

  ipcMain.handle(CHANNELS.windowSetAlwaysOnTop, () => {
    setAlwaysOnTop(true)
    store.setSettings({ alwaysOnTop: true })
    return true
  })

  ipcMain.handle(CHANNELS.windowSetMode, (_event, mode) => {
    setWindowMode(mode)
  })

  ipcMain.handle(CHANNELS.windowGetBounds, () => getWindowBounds())
  ipcMain.handle(CHANNELS.windowMoveTo, (_event, position: { x: number; y: number }) => {
    moveMainWindow(position)
  })
  ipcMain.handle(CHANNELS.windowPositionPreset, (_event, preset: number) => {
    moveToPreset(Number(preset))
  })
  ipcMain.handle(CHANNELS.windowNudge, (_event, direction: 'left' | 'right' | 'up' | 'down') => {
    nudgeWindow(direction)
  })
  ipcMain.handle(CHANNELS.windowRestoreTaskbar, () => {
    restoreTaskbarPresence()
  })
  ipcMain.handle(CHANNELS.windowSetSignedInReady, (_event, ready: boolean) => {
    setSignedInReady(Boolean(ready))
  })

  ipcMain.handle(CHANNELS.captureScreen, async () => captureScreenWithoutApp())
  ipcMain.handle(CHANNELS.captureActiveWindow, async () => captureActiveWindow())
  ipcMain.handle(CHANNELS.captureRegion, async () => captureRegion())

  ipcMain.handle(CHANNELS.audioGetSources, async () => getAudioSources())
  ipcMain.handle(CHANNELS.audioStartCapture, async (_event, sourceId: string) => {
    await startAudioCapture(sourceId, (chunk) => {
      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(CHANNELS.audioChunk, chunk)
      }
    })
  })
  ipcMain.handle(CHANNELS.audioStopCapture, async () => stopAudioCapture())

  ipcMain.handle(CHANNELS.settingsGet, () => store.getSettings())
  ipcMain.handle(CHANNELS.settingsSet, async (_event, partial: Partial<Settings>) => {
    const previous = store.getSettings()
    const settings = store.setSettings({ ...partial, alwaysOnTop: true })
    if (settings.hideFromCapture !== previous.hideFromCapture) setHideFromCapture(settings.hideFromCapture)
    setAlwaysOnTop(true)
    if (settings.theme !== previous.theme) applyNativeTheme(settings.theme)
    if (
      settings.theme !== previous.theme ||
      settings.transparency !== previous.transparency
    ) {
      applyWindowChrome(settings.theme, settings.transparency)
    }
    if (settings.launchAtStartup !== previous.launchAtStartup) {
      app.setLoginItemSettings({ openAtLogin: settings.launchAtStartup, enabled: settings.launchAtStartup })
    }
    if (
      settings.showInTaskbar !== previous.showInTaskbar ||
      settings.showInTray !== previous.showInTray ||
      settings.minimizeToTray !== previous.minimizeToTray
    ) {
      applyPresence()
    } else {
      refreshTray()
    }
    sendToRenderer(CHANNELS.settingsChanged, settings)
    return settings
  })

  ipcMain.handle(CHANNELS.shortcutsGet, () => store.getShortcuts())
  ipcMain.handle(CHANNELS.shortcutsGetFailed, () => getFailedShortcutIds())
  ipcMain.handle(CHANNELS.shortcutsSet, (_event, id: ShortcutId, accelerator: string) => {
    if (isAcceleratorTakenByOtherApp(accelerator)) {
      return { error: SHORTCUT_TAKEN_MESSAGE }
    }
    const shortcuts = normalizeShortcutMap({ ...store.getShortcuts(), [id]: accelerator })
    store.setShortcuts(shortcuts)
    registerShortcuts(shortcuts)
    sendToRenderer(CHANNELS.shortcutsChanged, shortcuts)
    return { shortcuts }
  })
  ipcMain.handle(CHANNELS.shortcutsReset, () => {
    const shortcuts = store.setShortcuts({ ...DEFAULT_SHORTCUTS })
    registerShortcuts(shortcuts)
    sendToRenderer(CHANNELS.shortcutsChanged, shortcuts)
    return shortcuts
  })
  ipcMain.on(CHANNELS.shortcutsSuspend, (_event, nextSuspended: boolean) => {
    suspendShortcuts(nextSuspended)
  })

  ipcMain.handle(CHANNELS.conversationsList, () => store.listConversations())
  ipcMain.handle(CHANNELS.conversationsGet, (_event, id: string) => store.getConversation(id))
  ipcMain.handle(CHANNELS.conversationsSave, (_event, conversation: Conversation) => {
    store.saveConversation(conversation)
  })
  ipcMain.handle(CHANNELS.conversationsDelete, (_event, id: string) => {
    store.deleteConversation(id)
  })
  ipcMain.handle(CHANNELS.conversationsClear, () => {
    store.clearConversations()
  })

  ipcMain.on(CHANNELS.aiChat, async (event, request: ChatRequest) => {
    abortController?.abort()
    abortController = new AbortController()
    const { signal } = abortController
    try {
      await generateResponse({
        messages: request.messages,
        settings: store.getSettings(),
        apiKey: credentials.getApiKey(),
        signal,
        onDelta: (delta) => {
          event.sender.send(CHANNELS.aiChunk, {
            conversationId: request.conversationId,
            messageId: request.messageId,
            delta,
          })
        },
      })
      if (signal.aborted) return
      event.sender.send(CHANNELS.aiDone, {
        conversationId: request.conversationId,
        messageId: request.messageId,
      })
      notifyIfUnfocused('Tudso', 'A response is ready.')
    } catch (error) {
      if (signal.aborted) return
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? ''
          : error instanceof Error
            ? error.message
            : 'Unable to generate a response. Check your connection or AI configuration.'
      if (!message) return
      event.sender.send(CHANNELS.aiError, {
        conversationId: request.conversationId,
        messageId: request.messageId,
        message,
      })
    }
  })

  ipcMain.on(CHANNELS.aiStop, () => {
    abortController?.abort()
    abortController = null
  })

  ipcMain.on(CHANNELS.appQuit, () => {
    app.quit()
  })

  ipcMain.handle(CHANNELS.appOpenExternal, async (_event, url: string) => {
    if (!/^https?:/i.test(url)) return
    await shell.openExternal(url)
  })

  ipcMain.handle(CHANNELS.appPickFiles, async () => {
    const options = {
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      filters: [
        { name: 'Text and code', extensions: ['txt', 'md', 'json', 'csv', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'css', 'html'] },
        { name: 'All files', extensions: ['*'] },
      ],
    }
    const win = getMainWindow()
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled) return [] satisfies PickedFile[]
    const { readFile, stat } = await import('node:fs/promises')
    const files: PickedFile[] = []
    for (const filePath of result.filePaths.slice(0, 4)) {
      const info = await stat(filePath)
      if (info.size > 400_000) continue
      const name = filePath.split(/[/\\]/).pop() ?? 'file'
      const raw = await readFile(filePath)
      const text = raw.toString('utf8')
      files.push({
        name,
        mime: 'text/plain',
        size: info.size,
        text: looksBinary(raw) ? undefined : text,
      })
    }
    return files
  })

  ipcMain.on(CHANNELS.appNotify, (_event, title: string, body: string) => {
    showNotification(title, body)
  })

  ipcMain.handle(CHANNELS.appDeleteLocalData, async () => {
    abortController?.abort()
    await credentials.clearAll()
    await store.deleteLocalData()
    locked = false
  })

  ipcMain.handle(CHANNELS.appGetApiKeyStatus, () => credentials.getApiKeyStatus())
  ipcMain.handle(CHANNELS.appSetApiKey, (_event, key: string) => credentials.setApiKey(key))
  ipcMain.handle(CHANNELS.appClearApiKey, () => credentials.clearApiKey())

  ipcMain.handle(CHANNELS.appSetPin, async (_event, pin: string) => {
    await credentials.setPin(pin)
    store.setSettings({ lockEnabled: true })
  })

  ipcMain.handle(CHANNELS.appUnlock, (_event, pin: string) => {
    const ok = credentials.verifyPin(pin)
    if (ok) locked = false
    return ok
  })

  ipcMain.handle(CHANNELS.appLock, () => {
    if (store.getSettings().lockEnabled && credentials.hasPin()) locked = true
  })

  ipcMain.handle(CHANNELS.appGetLockState, () => ({
    locked: locked && store.getSettings().lockEnabled,
    enabled: store.getSettings().lockEnabled && credentials.hasPin(),
  }))

  ipcMain.handle(CHANNELS.appGetVersion, () => app.getVersion())
}

function looksBinary(buffer: Buffer) {
  const sample = buffer.subarray(0, 800)
  return sample.includes(0)
}
