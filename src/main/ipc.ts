import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { CHANNELS } from '../shared/channels'
import type {
  AuthSession,
  ChatRequest,
  Conversation,
  LocalProfile,
  LocalResumeMeta,
  MemoryEntry,
  PickedFile,
  PickedResume,
  Settings,
  ShortcutId,
  AppMenuPopup,
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
import { applyLoginItem } from './platform'
import { applyPresence, isHideFromCaptureAllowed, refreshTray, setHideFromCaptureAllowed, setSignedInReady } from './presence'
import { importResumeFromBuffer } from './resume-import'
import { popupAppMenu } from './app-menu'
import { moveToPreset, nudgeWindow } from './window-position'
import {
  applyWindowChrome,
  getMainWindow,
  getWindowBounds,
  hideMainWindow,
  isFloatingEnabled,
  minimizeMainWindow,
  moveMainWindow,
  restoreTaskbarPresence,
  sendToRenderer,
  setAlwaysOnTop,
  setHideFromCapture,
  setWindowMode,
} from './windows'
import { beginOverlayDrag, cancelOverlayDrag, withOverlayPassthrough, withOverlayPassthroughAsync } from './overlay'

let abortController: AbortController | null = null
let locked = false

export function registerIpc(store: AppStore, credentials: CredentialStore) {
  locked = store.getSettings().lockEnabled && credentials.hasPin()

  ipcMain.handle(CHANNELS.authStartLogin, async () => {
    const deviceId = await credentials.getOrCreateDeviceId()
    return startLogin(deviceId, process.platform, app.getVersion())
  })
  ipcMain.handle(CHANNELS.authOpenLogin, async (_event, url: string) => openLogin(url))
  ipcMain.handle(CHANNELS.authSetSession, async (_event, session: AuthSession) => setSession(session, credentials))
  ipcMain.handle(CHANNELS.authGetSession, async () => getSession(credentials))
  ipcMain.handle(CHANNELS.authClearSession, async () => clearSession(credentials))

  ipcMain.on(CHANNELS.windowMinimize, () => {
    minimizeMainWindow(store.getSettings().minimizeToTray)
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
  ipcMain.handle(CHANNELS.windowPopupAppMenu, (event, opts: AppMenuPopup) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? getMainWindow()
    if (!win || win.isDestroyed()) return
    popupAppMenu(win, store, opts)
  })
  ipcMain.on(CHANNELS.overlayDragStart, () => {
    beginOverlayDrag()
  })
  ipcMain.on(CHANNELS.overlayDragCancel, () => {
    cancelOverlayDrag()
  })
  ipcMain.handle(CHANNELS.planVisibility, (_event, allowed: boolean) => {
    void setHideFromCaptureAllowed(Boolean(allowed), store)
  })

  ipcMain.handle(CHANNELS.captureScreen, async () => captureScreenWithoutApp(store.getSettings().hideFromCapture))
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
    if (partial.hideFromCapture && !isHideFromCaptureAllowed()) {
      partial = { ...partial, hideFromCapture: false }
    }
    if (partial.lockEnabled === false && credentials.hasPin()) {
      partial = { ...partial }
      delete partial.lockEnabled
    }
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
      applyLoginItem(settings.launchAtStartup)
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

  ipcMain.handle(CHANNELS.profileGet, (_event, userId: string) => store.getUserData(userId))
  ipcMain.handle(CHANNELS.profileSet, (_event, userId: string, profile: Partial<LocalProfile>) =>
    store.setUserProfile(userId, profile),
  )
  ipcMain.handle(CHANNELS.profileComplete, (_event, userId: string) => store.completeUserOnboarding(userId))
  ipcMain.handle(CHANNELS.profileSetMemory, (_event, userId: string, patch: { entries?: MemoryEntry[]; enabled?: boolean }) =>
    store.setUserMemory(userId, patch),
  )
  ipcMain.handle(CHANNELS.profileSaveResume, async (_event, userId: string, file: { fileName: string; mimeType: string; data: ArrayBuffer }) => {
    const data = await store.saveUserResume(userId, file)
    if (!data.resume) throw new Error('Could not save resume')
    return data
  })
  ipcMain.handle(CHANNELS.resumeParse, (_event, file: { fileName: string; mimeType: string; data: ArrayBuffer }) =>
    importResumeFromBuffer(file),
  )
  ipcMain.handle(CHANNELS.resumeParseUser, (_event, userId: string) => store.parseUserResume(userId))
  ipcMain.handle(CHANNELS.resumeParseSession, (_event, sessionId: string, meta: LocalResumeMeta) =>
    store.parseSessionResume(sessionId, meta),
  )
  ipcMain.handle(CHANNELS.profileDeleteResume, (_event, userId: string) => store.deleteUserResume(userId))
  ipcMain.handle(CHANNELS.sessionSaveResume, async (_event, sessionId: string, file: { fileName: string; mimeType: string; data: ArrayBuffer }) =>
    store.saveSessionResume(sessionId, file),
  )
  ipcMain.handle(CHANNELS.sessionCopyDefaultResume, (_event, userId: string, sessionId: string) =>
    store.copyDefaultResumeToSession(userId, sessionId),
  )

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

  ipcMain.on(CHANNELS.appConfirm, (event, message: string) => {
    const win = getMainWindow()
    event.returnValue = withOverlayPassthrough(() => {
      const options: Electron.MessageBoxSyncOptions = {
        type: 'question',
        buttons: ['Cancel', 'OK'],
        defaultId: 1,
        cancelId: 0,
        noLink: true,
        message: String(message || 'Are you sure?'),
      }
      const result =
        win && !win.isDestroyed() ? dialog.showMessageBoxSync(win, options) : dialog.showMessageBoxSync(options)
      return result === 1
    })
  })

  ipcMain.handle(CHANNELS.appOpenExternal, async (_event, url: string) => {
    if (!/^https?:/i.test(url)) return
    await shell.openExternal(url)
  })

  ipcMain.handle(CHANNELS.appPickFiles, async () => {
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Text and code', extensions: ['txt', 'md', 'json', 'csv', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'css', 'html'] },
        { name: 'All files', extensions: ['*'] },
      ],
    }
    const result = await showAppOpenDialog(options)
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

  ipcMain.handle(CHANNELS.appPickResume, async () => {
    const options: Electron.OpenDialogOptions = {
      title: 'Upload resume',
      properties: ['openFile'],
      filters: [
        { name: 'Resume', extensions: ['pdf', 'docx', 'txt', 'doc'] },
        { name: 'All files', extensions: ['*'] },
      ],
    }
    const result = await showAppOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    const { readFile, stat } = await import('node:fs/promises')
    const filePath = result.filePaths[0]
    const info = await stat(filePath)
    if (info.size > 10 * 1024 * 1024) throw new Error('Resume must be 10 MB or smaller.')
    const fileName = filePath.split(/[/\\]/).pop() ?? 'resume'
    if (!/\.(pdf|docx|txt|doc)$/i.test(fileName)) throw new Error('Use a PDF, DOCX, or TXT file.')
    const raw = await readFile(filePath)
    return {
      fileName,
      mimeType: mimeFromResumeName(fileName),
      data: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    } satisfies PickedResume
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

  ipcMain.handle(CHANNELS.appSetPin, async (_event, pin: string, currentPin?: string) => {
    if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4 to 8 digits.')
    if (credentials.hasPin() && !credentials.verifyPin(currentPin ?? '')) {
      throw new Error('Current PIN does not match.')
    }
    await credentials.setPin(pin)
    const settings = store.setSettings({ lockEnabled: true })
    sendToRenderer(CHANNELS.settingsChanged, settings)
  })

  ipcMain.handle(CHANNELS.appClearPin, async (_event, currentPin: string) => {
    if (!credentials.verifyPin(currentPin)) return false
    await credentials.clearPin()
    const settings = store.setSettings({ lockEnabled: false })
    locked = false
    sendToRenderer(CHANNELS.settingsChanged, settings)
    return true
  })

  let pinFails = 0
  let pinBlockedUntil = 0
  ipcMain.handle(CHANNELS.appUnlock, (_event, pin: string) => {
    if (Date.now() < pinBlockedUntil) return false
    const ok = credentials.verifyPin(pin)
    if (ok) {
      pinFails = 0
      locked = false
      return true
    }
    pinFails += 1
    if (pinFails >= 5) {
      pinBlockedUntil = Date.now() + 30_000
      pinFails = 0
    }
    return false
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

function mimeFromResumeName(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === 'doc') return 'application/msword'
  if (ext === 'txt') return 'text/plain'
  return 'application/octet-stream'
}

function showAppOpenDialog(options: Electron.OpenDialogOptions) {
  const win = getMainWindow()
  const parented = Boolean(win && !win.isDestroyed() && !isFloatingEnabled())
  return withOverlayPassthroughAsync(() =>
    parented && win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options),
  )
}
