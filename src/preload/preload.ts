import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '../shared/channels'
import type { ElectronAPI } from '../shared/electron-api'
import type {
  AuthSession,
  ChatRequest,
  Conversation,
  Settings,
  ShortcutId,
  ShortcutMap,
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void) {
  const listener = (_event: unknown, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: ElectronAPI = {
  platform: process.platform,
  auth: {
    startLogin: () => ipcRenderer.invoke(CHANNELS.authStartLogin),
    openLogin: (url: string) => ipcRenderer.invoke(CHANNELS.authOpenLogin, url),
    setSession: (session: AuthSession) => ipcRenderer.invoke(CHANNELS.authSetSession, session),
    getSession: () => ipcRenderer.invoke(CHANNELS.authGetSession),
    clearSession: () => ipcRenderer.invoke(CHANNELS.authClearSession),
    onAuthCallback: (callback) => subscribe(CHANNELS.authCallback, callback),
  },
  window: {
    minimize: () => ipcRenderer.send(CHANNELS.windowMinimize),
    close: () => ipcRenderer.send(CHANNELS.windowClose),
    hide: () => ipcRenderer.send(CHANNELS.windowHide),
    setAlwaysOnTop: (value) => ipcRenderer.invoke(CHANNELS.windowSetAlwaysOnTop, value),
    setMode: (mode) => ipcRenderer.invoke(CHANNELS.windowSetMode, mode),
    getBounds: () => ipcRenderer.invoke(CHANNELS.windowGetBounds),
    moveTo: (position) => ipcRenderer.invoke(CHANNELS.windowMoveTo, position),
    positionTo: (preset) => ipcRenderer.invoke(CHANNELS.windowPositionPreset, preset),
    nudge: (direction) => ipcRenderer.invoke(CHANNELS.windowNudge, direction),
    restoreTaskbar: () => ipcRenderer.invoke(CHANNELS.windowRestoreTaskbar),
    setSignedInReady: (ready: boolean) => ipcRenderer.invoke(CHANNELS.windowSetSignedInReady, ready),
    popupAppMenu: (opts) => ipcRenderer.invoke(CHANNELS.windowPopupAppMenu, opts),
    setHideFromCaptureAllowed: (allowed: boolean) => ipcRenderer.invoke(CHANNELS.planVisibility, allowed),
    onCollapsed: (callback) => subscribe(CHANNELS.windowCollapsed, callback),
    onOverlayKey: (callback) => subscribe(CHANNELS.overlayKey, callback),
    onOverlayPointer: (callback) => subscribe(CHANNELS.overlayPointer, callback),
    beginOverlayDrag: () => ipcRenderer.send(CHANNELS.overlayDragStart),
    cancelOverlayDrag: () => ipcRenderer.send(CHANNELS.overlayDragCancel),
  },
  settings: {
    get: () => ipcRenderer.invoke(CHANNELS.settingsGet),
    set: (partial: Partial<Settings>) => ipcRenderer.invoke(CHANNELS.settingsSet, partial),
    onChange: (callback) => subscribe(CHANNELS.settingsChanged, callback),
  },
  shortcuts: {
    get: () => ipcRenderer.invoke(CHANNELS.shortcutsGet),
    getFailed: () => ipcRenderer.invoke(CHANNELS.shortcutsGetFailed),
    set: async (id: ShortcutId, accelerator: string) => {
      const result = (await ipcRenderer.invoke(CHANNELS.shortcutsSet, id, accelerator)) as
        | { error: string }
        | { shortcuts: ShortcutMap }
      if ('error' in result) throw new Error(result.error)
      return result.shortcuts
    },
    reset: () => ipcRenderer.invoke(CHANNELS.shortcutsReset),
    suspend: (suspended: boolean) => ipcRenderer.send(CHANNELS.shortcutsSuspend, suspended),
    onChange: (callback) => subscribe(CHANNELS.shortcutsChanged, callback),
    onFailed: (callback) => subscribe(CHANNELS.shortcutsFailed, callback),
  },
  conversations: {
    list: () => ipcRenderer.invoke(CHANNELS.conversationsList),
    get: (id: string) => ipcRenderer.invoke(CHANNELS.conversationsGet, id),
    save: (conversation: Conversation) => ipcRenderer.invoke(CHANNELS.conversationsSave, conversation),
    delete: (id: string) => ipcRenderer.invoke(CHANNELS.conversationsDelete, id),
    clear: () => ipcRenderer.invoke(CHANNELS.conversationsClear),
  },
  profile: {
    get: (userId: string) => ipcRenderer.invoke(CHANNELS.profileGet, userId),
    set: (userId: string, profile) => ipcRenderer.invoke(CHANNELS.profileSet, userId, profile),
    complete: (userId: string) => ipcRenderer.invoke(CHANNELS.profileComplete, userId),
    setMemory: (userId, patch) => ipcRenderer.invoke(CHANNELS.profileSetMemory, userId, patch),
    saveResume: (userId: string, file, imported) => ipcRenderer.invoke(CHANNELS.profileSaveResume, userId, file, imported),
    deleteResume: (userId: string) => ipcRenderer.invoke(CHANNELS.profileDeleteResume, userId),
  },
  resume: {
    parse: (file) => ipcRenderer.invoke(CHANNELS.resumeParse, file),
    extract: (file) => ipcRenderer.invoke(CHANNELS.resumeExtract, file),
    parseUser: (userId) => ipcRenderer.invoke(CHANNELS.resumeParseUser, userId),
    parseSession: (sessionId, meta) => ipcRenderer.invoke(CHANNELS.resumeParseSession, sessionId, meta),
  },
  sessions: {
    saveResume: (sessionId, file, imported) => ipcRenderer.invoke(CHANNELS.sessionSaveResume, sessionId, file, imported),
    copyDefaultResume: (userId, sessionId) => ipcRenderer.invoke(CHANNELS.sessionCopyDefaultResume, userId, sessionId),
  },
  ai: {
    chat: (request: ChatRequest) => ipcRenderer.send(CHANNELS.aiChat, request),
    stop: () => ipcRenderer.send(CHANNELS.aiStop),
    onChunk: (callback) => subscribe(CHANNELS.aiChunk, callback),
    onDone: (callback) => subscribe(CHANNELS.aiDone, callback),
    onError: (callback) => subscribe(CHANNELS.aiError, callback),
  },
  app: {
    quit: () => ipcRenderer.send(CHANNELS.appQuit),
    openExternal: (url: string) => ipcRenderer.invoke(CHANNELS.appOpenExternal, url),
    pickFiles: () => ipcRenderer.invoke(CHANNELS.appPickFiles),
    pickResume: () => ipcRenderer.invoke(CHANNELS.appPickResume),
    confirm: (message: string) => ipcRenderer.sendSync(CHANNELS.appConfirm, message) as boolean,
    writeClipboard: (text: string) => {
      ipcRenderer.sendSync(CHANNELS.appWriteClipboard, text)
    },
    notify: (title: string, body: string) => ipcRenderer.send(CHANNELS.appNotify, title, body),
    deleteLocalData: () => ipcRenderer.invoke(CHANNELS.appDeleteLocalData),
    getApiKeyStatus: () => ipcRenderer.invoke(CHANNELS.appGetApiKeyStatus),
    setApiKey: (key: string) => ipcRenderer.invoke(CHANNELS.appSetApiKey, key),
    clearApiKey: () => ipcRenderer.invoke(CHANNELS.appClearApiKey),
    setPin: (pin: string, currentPin?: string) => ipcRenderer.invoke(CHANNELS.appSetPin, pin, currentPin),
    clearPin: (currentPin: string) => ipcRenderer.invoke(CHANNELS.appClearPin, currentPin),
    unlock: (pin: string) => ipcRenderer.invoke(CHANNELS.appUnlock, pin),
    lock: () => ipcRenderer.invoke(CHANNELS.appLock),
    getLockState: () => ipcRenderer.invoke(CHANNELS.appGetLockState),
    onCommand: (callback) => subscribe(CHANNELS.appCommand, callback),
    getVersion: () => ipcRenderer.invoke(CHANNELS.appGetVersion),
  },
  capture: {
    screen: () => ipcRenderer.invoke(CHANNELS.captureScreen),
    activeWindow: () => ipcRenderer.invoke(CHANNELS.captureActiveWindow),
    region: () => ipcRenderer.invoke(CHANNELS.captureRegion),
  },
  audio: {
    getSources: () => ipcRenderer.invoke(CHANNELS.audioGetSources),
    startCapture: (sourceId: string) => ipcRenderer.invoke(CHANNELS.audioStartCapture, sourceId),
    stopCapture: () => ipcRenderer.invoke(CHANNELS.audioStopCapture),
    onChunk: (callback) => subscribe(CHANNELS.audioChunk, callback),
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
