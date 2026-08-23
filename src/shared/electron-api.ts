import type {
  ApiKeyStatus,
  AppCommand,
  AuthSession,
  ChatRequest,
  Conversation,
  LocalProfile,
  LocalResumeMeta,
  LocalUserData,
  MemoryEntry,
  ResumeImportResult,
  OverlayKeyEvent,
  OverlayPointerEvent,
  PickedFile,
  PickedResume,
  Settings,
  ShortcutId,
  ShortcutMap,
  StreamChunk,
  StreamDone,
  StreamError,
  WindowBounds,
  WindowMode,
  AppMenuPopup,
} from './types'

export interface ElectronAPI {
  platform: string
  auth: {
    startLogin: () => Promise<{ url: string; state: string }>
    openLogin: (url: string) => Promise<void>
    setSession: (session: AuthSession) => Promise<void>
    getSession: () => Promise<AuthSession | null>
    clearSession: () => Promise<void>
    onAuthCallback: (callback: (session: AuthSession) => void) => () => void
  }
  window: {
    minimize: () => void
    close: () => void
    hide: () => void
    setAlwaysOnTop: (value: boolean) => Promise<boolean>
    setMode: (mode: WindowMode) => Promise<void>
    getBounds: () => Promise<WindowBounds | null>
    moveTo: (position: { x: number; y: number }) => Promise<void>
    positionTo: (preset: number) => Promise<void>
    nudge: (direction: 'left' | 'right' | 'up' | 'down') => Promise<void>
    restoreTaskbar: () => Promise<void>
    setSignedInReady: (ready: boolean) => Promise<void>
    popupAppMenu: (opts: AppMenuPopup) => Promise<void>
    setHideFromCaptureAllowed: (allowed: boolean) => Promise<void>
    onCollapsed: (callback: (collapsed: boolean) => void) => () => void
    onOverlayKey: (callback: (event: OverlayKeyEvent) => void) => () => void
    onOverlayPointer: (callback: (event: OverlayPointerEvent) => void) => () => void
    beginOverlayDrag: () => void
    cancelOverlayDrag: () => void
  }
  settings: {
    get: () => Promise<Settings>
    set: (partial: Partial<Settings>) => Promise<Settings>
    onChange: (callback: (settings: Settings) => void) => () => void
  }
  shortcuts: {
    get: () => Promise<ShortcutMap>
    getFailed: () => Promise<ShortcutId[]>
    set: (id: ShortcutId, accelerator: string) => Promise<ShortcutMap>
    reset: () => Promise<ShortcutMap>
    suspend: (suspended: boolean) => void
    onChange: (callback: (shortcuts: ShortcutMap) => void) => () => void
    onFailed: (callback: (ids: ShortcutId[]) => void) => () => void
  }
  conversations: {
    list: () => Promise<Conversation[]>
    get: (id: string) => Promise<Conversation | null>
    save: (conversation: Conversation) => Promise<void>
    delete: (id: string) => Promise<void>
    clear: () => Promise<void>
  }
  profile: {
    get: (userId: string) => Promise<LocalUserData>
    set: (userId: string, profile: Partial<LocalProfile>) => Promise<LocalUserData>
    complete: (userId: string) => Promise<LocalUserData>
    setMemory: (userId: string, patch: { entries?: MemoryEntry[]; enabled?: boolean }) => Promise<LocalUserData>
    saveResume: (userId: string, file: { fileName: string; mimeType: string; data: ArrayBuffer }) => Promise<LocalUserData>
    deleteResume: (userId: string) => Promise<LocalUserData>
  }
  resume: {
    parse: (file: { fileName: string; mimeType: string; data: ArrayBuffer }) => Promise<ResumeImportResult>
    parseUser: (userId: string) => Promise<ResumeImportResult | null>
    parseSession: (sessionId: string, meta: LocalResumeMeta) => Promise<ResumeImportResult | null>
  }
  sessions: {
    saveResume: (sessionId: string, file: { fileName: string; mimeType: string; data: ArrayBuffer }) => Promise<LocalResumeMeta>
    copyDefaultResume: (userId: string, sessionId: string) => Promise<LocalResumeMeta | null>
  }
  ai: {
    chat: (request: ChatRequest) => void
    stop: () => void
    onChunk: (callback: (chunk: StreamChunk) => void) => () => void
    onDone: (callback: (done: StreamDone) => void) => () => void
    onError: (callback: (error: StreamError) => void) => () => void
  }
  app: {
    quit: () => void
    openExternal: (url: string) => Promise<void>
    pickFiles: () => Promise<PickedFile[]>
    pickResume: () => Promise<PickedResume | null>
    confirm: (message: string) => boolean
    notify: (title: string, body: string) => void
    deleteLocalData: () => Promise<void>
    getApiKeyStatus: () => Promise<ApiKeyStatus>
    setApiKey: (key: string) => Promise<ApiKeyStatus>
    clearApiKey: () => Promise<ApiKeyStatus>
    setPin: (pin: string, currentPin?: string) => Promise<void>
    clearPin: (currentPin: string) => Promise<boolean>
    unlock: (pin: string) => Promise<boolean>
    lock: () => Promise<void>
    getLockState: () => Promise<{ locked: boolean; enabled: boolean }>
    onCommand: (callback: (command: AppCommand) => void) => () => void
    getVersion: () => Promise<string>
  }
  capture: {
    screen: () => Promise<string | null>
    activeWindow: () => Promise<string | null>
    region: () => Promise<string | null>
  }
  audio: {
    getSources: () => Promise<Array<{ id: string; name: string }>>
    startCapture: (sourceId: string) => Promise<void>
    stopCapture: () => Promise<void>
    onChunk: (callback: (chunk: ArrayBuffer) => void) => () => void
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
