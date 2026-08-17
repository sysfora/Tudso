export type ThemeMode = 'dark' | 'light' | 'system'
export type WindowMode = 'compact' | 'normal' | 'expanded'
export type ResponseLength = 'short' | 'medium' | 'long'
export type MessageRole = 'user' | 'assistant' | 'system'
export type SettingsSection =
  | 'general'
  | 'appearance'
  | 'shortcuts'
  | 'ai'
  | 'privacy'
  | 'profile'
  | 'memory'
  | 'subscription'
  | 'account'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface AuthSession {
  token: string
  userId: string
  email: string
}

export type OnboardingStep =
  | 'welcome'
  | 'name'
  | 'profession'
  | 'resume'
  | 'goals'
  | 'preferences'
  | 'subscription'
  | 'complete'

export interface Settings {
  launchAtStartup: boolean
  startMinimized: boolean
  rememberPosition: boolean
  rememberSize: boolean
  alwaysOnTop: boolean
  hideFromCapture: boolean
  showInTaskbar: boolean
  showInTray: boolean
  minimizeToTray: boolean
  theme: ThemeMode
  compactMode: boolean
  fontSize: number
  transparency: boolean
  transparencyAmount: number
  model: string
  temperature: number
  responseLength: ResponseLength
  streaming: boolean
  privacyMode: boolean
  lockEnabled: boolean
  retentionDays: number | null
  apiBaseUrl: string
  releaseChannel: ReleaseChannel
  defaultsRevision: number
}

export type ReleaseChannel = 'stable' | 'beta' | 'alpha'

export const ANSWER_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export type AnswerIndex = (typeof ANSWER_INDEXES)[number]

export type CopyAnswerShortcutId =
  | `copyAnswer${AnswerIndex}`
  | `copyAnswerPlain${AnswerIndex}`
  | `copyAnswerCode${AnswerIndex}`

export type CopyAnswerCommand =
  | `copy-answer-${AnswerIndex}`
  | `copy-answer-plain-${AnswerIndex}`
  | `copy-answer-code-${AnswerIndex}`

export interface ShortcutMap {
  toggleWindow: string
  toggleCollapsed: string
  newConversation: string
  endSession: string
  nextConversation: string
  previousConversation: string
  askScreen: string
  liveCopilotScreen: string
  liveCopilotAudio: string
  stopGeneration: string
  copyLastAnswer: string
  copyLastAnswerPlain: string
  copyLastCode: string
  copyAnswer1: string
  copyAnswer2: string
  copyAnswer3: string
  copyAnswer4: string
  copyAnswer5: string
  copyAnswer6: string
  copyAnswer7: string
  copyAnswer8: string
  copyAnswer9: string
  copyAnswerPlain1: string
  copyAnswerPlain2: string
  copyAnswerPlain3: string
  copyAnswerPlain4: string
  copyAnswerPlain5: string
  copyAnswerPlain6: string
  copyAnswerPlain7: string
  copyAnswerPlain8: string
  copyAnswerPlain9: string
  copyAnswerCode1: string
  copyAnswerCode2: string
  copyAnswerCode3: string
  copyAnswerCode4: string
  copyAnswerCode5: string
  copyAnswerCode6: string
  copyAnswerCode7: string
  copyAnswerCode8: string
  copyAnswerCode9: string
  focusComposer: string
  openSettings: string
  togglePrivacy: string
  toggleHideFromCapture: string
  openCommandPalette: string
  toggleModel: string
  windowCompact: string
  windowNormal: string
  windowExpanded: string
  increaseFontSize: string
  decreaseFontSize: string
  positionWindow1: string
  positionWindow2: string
  positionWindow3: string
  positionWindow4: string
  positionWindow5: string
  positionWindow6: string
  positionWindow7: string
  positionWindow8: string
  positionWindow9: string
  moveWindowLeft: string
  moveWindowRight: string
  moveWindowUp: string
  moveWindowDown: string
}

export type ShortcutId = keyof ShortcutMap

export interface Attachment {
  id: string
  name: string
  mime: string
  size: number
  text?: string
  dataUrl?: string
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  error?: boolean
  attachments?: Attachment[]
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export interface ChatRequest {
  conversationId: string
  messageId: string
  messages: ChatMessage[]
}

export interface StreamChunk {
  conversationId: string
  messageId: string
  delta: string
}

export interface StreamDone {
  conversationId: string
  messageId: string
}

export interface StreamError {
  conversationId: string
  messageId: string
  message: string
}

export type AppCommand =
  | 'new-conversation'
  | 'end-session'
  | 'focus-composer'
  | 'copy-last-answer'
  | 'copy-last-answer-plain'
  | 'copy-last-code'
  | CopyAnswerCommand
  | 'open-settings'
  | 'open-account'
  | 'open-subscription'
  | 'toggle-privacy'
  | 'toggle-hide-from-capture'
  | 'toggle-collapsed'
  | 'open-command-palette'
  | 'toggle-model'
  | 'next-conversation'
  | 'previous-conversation'
  | 'window-compact'
  | 'window-normal'
  | 'window-expanded'
  | 'increase-font-size'
  | 'decrease-font-size'
  | 'hide-window'
  | 'send-message'
  | 'stop-generation'
  | 'ask-screen'
  | 'live-copilot-screen'
  | 'live-copilot-audio'
  | 'position-window-1'
  | 'position-window-2'
  | 'position-window-3'
  | 'position-window-4'
  | 'position-window-5'
  | 'position-window-6'
  | 'position-window-7'
  | 'position-window-8'
  | 'position-window-9'
  | 'move-window-left'
  | 'move-window-right'
  | 'move-window-up'
  | 'move-window-down'

export interface ApiKeyStatus {
  configured: boolean
  encrypted: boolean
}

export interface PickedFile {
  name: string
  mime: string
  size: number
  text?: string
}
