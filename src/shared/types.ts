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

export interface AppMenuPopup {
  x: number
  y: number
  email?: string
  hideAllowed: boolean
  sessionLive: boolean
  hasConversation: boolean
  windowMode: WindowMode
}

export interface OverlayKeyEvent {
  down: boolean
  key: string
  code: string
  text: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  paste?: string
}

export interface OverlayPointerEvent {
  type: 'down' | 'up' | 'move' | 'wheel'
  button: number
  x: number
  y: number
  screenX: number
  screenY: number
  deltaY?: number
}

export interface AuthSession {
  token: string
  userId: string
  email: string
  deviceId?: string
}

export interface LocalProfile {
  preferredName?: string
  profession?: string
  role?: string
  industry?: string
  education?: string
  skills: string[]
  goals: string[]
  communicationStyle?: 'concise' | 'balanced' | 'detailed'
  technicalLevel?: 'beginner' | 'intermediate' | 'advanced'
  formal?: boolean
  stepByStep?: boolean
  examples?: boolean
  explainTerms?: boolean
  customContext?: string
}

export interface LocalResumeMeta {
  fileName: string
  mimeType: string
  storedName: string
}

export interface ParsedResume {
  name?: string
  headline?: string
  summary?: string
  industry?: string
  skills: string[]
  languages: string[]
  goals: string[]
  experience: Array<{ company?: string; role?: string; duration?: string; description?: string }>
  education: Array<{ institution?: string; degree?: string; year?: string }>
  projects: Array<{ name?: string; description?: string; technologies?: string[] }>
  certifications: string[]
  achievements: string[]
  technicalLevel?: 'beginner' | 'intermediate' | 'advanced'
}

export interface ResumeImportResult {
  parsed: ParsedResume
  profile: Partial<LocalProfile>
  memories: string[]
  text: string
  extractedChars: number
}

export type MemorySource = 'auto' | 'manual'

export interface MemoryEntry {
  id: string
  text: string
  created: string
  source?: MemorySource
}

export interface LocalUserData {
  complete: boolean
  profile: LocalProfile
  resume?: LocalResumeMeta
  memories: MemoryEntry[]
  memoryEnabled: boolean
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
  scrollUp: string
  scrollDown: string
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

export interface SessionPromptResume {
  parsed: ParsedResume
  text: string
}

export interface SessionContext {
  profile: LocalProfile
  resume?: LocalResumeMeta
  promptResume?: SessionPromptResume
  promptMemories?: string[]
  usedDefaults: boolean
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  context?: SessionContext
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
  | 'open-shortcuts'
  | 'continue-session'
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
  | 'scroll-up'
  | 'scroll-down'

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

export interface PickedResume {
  fileName: string
  mimeType: string
  data: ArrayBuffer
}
