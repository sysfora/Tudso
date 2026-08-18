import type {
  ApiKeyStatus,
  AppCommand,
  AuthSession,
  ChatRequest,
  Conversation,
  PickedFile,
  Settings,
  ShortcutId,
  ShortcutMap,
  StreamChunk,
  StreamDone,
  StreamError,
  WindowBounds,
  WindowMode,
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
    setHideFromCaptureAllowed: (allowed: boolean) => Promise<void>
    onCollapsed: (callback: (collapsed: boolean) => void) => () => void
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
