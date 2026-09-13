import type { AnswerIndex, Settings, ShortcutMap, WindowBounds } from './types'
import { ANSWER_INDEXES } from './types'

export const APP_NAME = 'Tudso'
export const APP_ID = 'com.sysfora.tudso'

export const DEFAULT_BOUNDS: WindowBounds = {
  x: 0,
  y: 0,
  width: 520,
  height: 680,
}

export const FONT_SIZE_MIN = 12
export const FONT_SIZE_MAX = 18

export const WINDOW_SIZES = {
  compact: { width: 420, height: 560 },
  normal: { width: 520, height: 680 },
  expanded: { width: 1100, height: 760 },
} as const

export const FAST_CHAT_MODEL = 'gpt-4.1-nano'
export const INTELLIGENT_CHAT_MODEL = 'gpt-4.1'

export const DEFAULT_SETTINGS: Settings = {
  launchAtStartup: false,
  startMinimized: false,
  rememberPosition: true,
  rememberSize: true,
  alwaysOnTop: true,
  hideFromCapture: true,
  showInTaskbar: false,
  showInTray: false,
  minimizeToTray: false,
  theme: 'dark',
  compactMode: true,
  fontSize: 14,
  transparency: true,
  transparencyAmount: 10,
  model: FAST_CHAT_MODEL,
  temperature: 0.7,
  responseLength: 'medium',
  streaming: true,
  privacyMode: false,
  lockEnabled: false,
  retentionDays: null,
  apiBaseUrl: 'https://api.openai.com/v1',
  releaseChannel: 'stable',
  defaultsRevision: 11,
}

export const SHORTCUT_TAKEN_MESSAGE =
  "This shortcut is used by another app. We can't bind it. Pick a different one."

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  toggleWindow: 'Control+Alt+Space',
  toggleCollapsed: 'Control+Alt+M',
  newConversation: 'Control+Alt+N',
  endSession: 'Control+Alt+X',
  nextConversation: 'Control+Alt+]',
  previousConversation: 'Control+Alt+[',
  askScreen: 'Control+Alt+S',
  liveCopilotAudio: 'Control+Alt+A',
  stopGeneration: 'Control+Alt+.',
  copyLastAnswer: 'Control+Alt+C',
  copyLastAnswerPlain: 'Control+Alt+T',
  copyLastCode: 'Control+Alt+E',
  ...copyAnswerShortcutDefaults(),
  focusComposer: 'Control+Alt+K',
  openSettings: 'Control+Alt+,',
  togglePrivacy: 'Control+Alt+P',
  toggleHideFromCapture: 'Control+Alt+H',
  openCommandPalette: 'Control+Alt+/',
  toggleModel: 'Control+Alt+I',
  windowCompact: 'Control+Alt+Shift+1',
  windowNormal: 'Control+Alt+Shift+2',
  windowExpanded: 'Control+Alt+Shift+3',
  increaseFontSize: 'Control+Alt+=',
  decreaseFontSize: 'Control+Alt+-',
  positionWindow1: 'Control+Alt+Shift+Q',
  positionWindow2: 'Control+Alt+Shift+W',
  positionWindow3: 'Control+Alt+Shift+E',
  positionWindow4: 'Control+Alt+Shift+A',
  positionWindow5: 'Control+Alt+Shift+S',
  positionWindow6: 'Control+Alt+Shift+D',
  positionWindow7: 'Control+Alt+Shift+Z',
  positionWindow8: 'Control+Alt+Shift+X',
  positionWindow9: 'Control+Alt+Shift+C',
  moveWindowLeft: 'Control+Alt+Shift+Left',
  moveWindowRight: 'Control+Alt+Shift+Right',
  moveWindowUp: 'Control+Alt+Shift+Up',
  moveWindowDown: 'Control+Alt+Shift+Down',
  scrollUp: 'Control+Alt+U',
  scrollDown: 'Control+Alt+J',
}

export const SHORTCUT_LABELS: Record<keyof ShortcutMap, string> = {
  toggleWindow: 'Show or hide',
  toggleCollapsed: 'Collapse or expand',
  newConversation: 'New session',
  endSession: 'End session',
  nextConversation: 'Next session',
  previousConversation: 'Previous session',
  askScreen: 'Answer from screen',
  liveCopilotAudio: 'Live copilot',
  stopGeneration: 'Stop listening or generating',
  copyLastAnswer: 'Copy last answer, markdown',
  copyLastAnswerPlain: 'Copy last answer, plain',
  copyLastCode: 'Copy last answer, code',
  ...copyAnswerShortcutLabels(),
  focusComposer: 'Focus prompt',
  openSettings: 'Open settings',
  togglePrivacy: 'Privacy mode',
  toggleHideFromCapture: 'Hide from screen share',
  openCommandPalette: 'Command palette',
  toggleModel: 'Switch model',
  windowCompact: 'Compact window',
  windowNormal: 'Normal window',
  windowExpanded: 'Expanded window',
  increaseFontSize: 'Increase font size',
  decreaseFontSize: 'Decrease font size',
  positionWindow1: 'Position top left',
  positionWindow2: 'Position top center',
  positionWindow3: 'Position top right',
  positionWindow4: 'Position center left',
  positionWindow5: 'Position center',
  positionWindow6: 'Position center right',
  positionWindow7: 'Position bottom left',
  positionWindow8: 'Position bottom center',
  positionWindow9: 'Position bottom right',
  moveWindowLeft: 'Nudge left',
  moveWindowRight: 'Nudge right',
  moveWindowUp: 'Nudge up',
  moveWindowDown: 'Nudge down',
  scrollUp: 'Scroll up',
  scrollDown: 'Scroll down',
}

export const SHORTCUT_DESCRIPTIONS: Record<keyof ShortcutMap, string> = {
  toggleWindow: 'Bring Tudso up or hide it completely.',
  toggleCollapsed: 'Shrink to the title bar, or restore the full window.',
  newConversation: 'Start a new session. Asks for name, resume, and preferences first. Disabled while one is already live.',
  endSession: 'Stop the live session, copilot, and generation.',
  nextConversation: 'Jump to the next session in the list.',
  previousConversation: 'Jump to the previous session in the list.',
  askScreen: 'Capture the screen and answer what is on it.',
  liveCopilotAudio: 'Listen, then answer after you pause.',
  stopGeneration: 'Stop voice, live copilot, or an answer in progress.',
  copyLastAnswer: 'Copy the latest assistant reply as markdown.',
  copyLastAnswerPlain: 'Copy the latest assistant reply as plain text.',
  copyLastCode: 'Copy code from the latest assistant reply.',
  ...copyAnswerShortcutDescriptions(),
  focusComposer: 'Put the cursor in the prompt box.',
  openSettings: 'Open settings.',
  togglePrivacy: 'Hide message text on screen.',
  toggleHideFromCapture: 'Show or hide Tudso in screenshots and screen shares.',
  openCommandPalette: 'Search commands.',
  toggleModel: 'Switch between Fast (GPT-4.1 nano) and Intelligent (GPT-4.1).',
  windowCompact: 'Resize to the compact window size.',
  windowNormal: 'Resize to the normal window size.',
  windowExpanded: 'Resize to the expanded window size.',
  increaseFontSize: 'Make text in the window one step larger.',
  decreaseFontSize: 'Make text in the window one step smaller.',
  positionWindow1: 'Snap to the top left of the screen.',
  positionWindow2: 'Snap to the top center of the screen.',
  positionWindow3: 'Snap to the top right of the screen.',
  positionWindow4: 'Snap to the center left of the screen.',
  positionWindow5: 'Snap to the center of the screen.',
  positionWindow6: 'Snap to the center right of the screen.',
  positionWindow7: 'Snap to the bottom left of the screen.',
  positionWindow8: 'Snap to the bottom center of the screen.',
  positionWindow9: 'Snap to the bottom right of the screen.',
  moveWindowLeft: 'Move the window left a step.',
  moveWindowRight: 'Move the window right a step.',
  moveWindowUp: 'Move the window up a step.',
  moveWindowDown: 'Move the window down a step.',
  scrollUp: 'Scroll the conversation up.',
  scrollDown: 'Scroll the conversation down.',
}

export const SHORTCUT_GROUPS: { title: string; ids: (keyof ShortcutMap)[] }[] = [
  {
    title: 'Window',
    ids: [
      'toggleWindow',
      'toggleCollapsed',
      'windowCompact',
      'windowNormal',
      'windowExpanded',
      'increaseFontSize',
      'decreaseFontSize',
    ],
  },
  {
    title: 'Position',
    ids: [
      'positionWindow1',
      'positionWindow2',
      'positionWindow3',
      'positionWindow4',
      'positionWindow5',
      'positionWindow6',
      'positionWindow7',
      'positionWindow8',
      'positionWindow9',
      'moveWindowLeft',
      'moveWindowRight',
      'moveWindowUp',
      'moveWindowDown',
    ],
  },
  {
    title: 'Session',
    ids: ['newConversation', 'endSession', 'previousConversation', 'nextConversation'],
  },
  {
    title: 'Copilot',
    ids: ['askScreen', 'liveCopilotAudio', 'stopGeneration'],
  },
  {
    title: 'Copy last',
    ids: ['copyLastAnswer', 'copyLastAnswerPlain', 'copyLastCode'],
  },
  {
    title: 'Copy answer · markdown',
    ids: ANSWER_INDEXES.map((index) => `copyAnswer${index}` as const),
  },
  {
    title: 'Copy answer · plain',
    ids: ANSWER_INDEXES.map((index) => `copyAnswerPlain${index}` as const),
  },
  {
    title: 'Copy answer · code',
    ids: ANSWER_INDEXES.map((index) => `copyAnswerCode${index}` as const),
  },
  {
    title: 'Chat',
    ids: ['focusComposer', 'toggleModel', 'scrollUp', 'scrollDown'],
  },
  {
    title: 'App',
    ids: ['openSettings', 'openCommandPalette', 'togglePrivacy', 'toggleHideFromCapture'],
  },
]

export function normalizeShortcutMap(input?: Partial<ShortcutMap> | null): ShortcutMap {
  const next = { ...DEFAULT_SHORTCUTS }
  if (!input) return next
  for (const id of Object.keys(DEFAULT_SHORTCUTS) as (keyof ShortcutMap)[]) {
    const value = input[id]
    if (typeof value === 'string' && value.trim()) next[id] = value
  }
  return next
}

function latestLabel(index: AnswerIndex) {
  return index === 1 ? ' (latest)' : ''
}

function copyAnswerShortcutDefaults(): Pick<
  ShortcutMap,
  | `copyAnswer${AnswerIndex}`
  | `copyAnswerPlain${AnswerIndex}`
  | `copyAnswerCode${AnswerIndex}`
> {
  const next = {} as Pick<
    ShortcutMap,
    | `copyAnswer${AnswerIndex}`
    | `copyAnswerPlain${AnswerIndex}`
    | `copyAnswerCode${AnswerIndex}`
  >
  for (const index of ANSWER_INDEXES) {
    next[`copyAnswer${index}`] = `Control+Alt+${index}`
    next[`copyAnswerPlain${index}`] = index === 8 ? 'Control+Alt+Shift+8' : `Control+Alt+F${index}`
    next[`copyAnswerCode${index}`] = index === 8 ? 'Control+Alt+Shift+0' : `Control+Alt+Shift+F${index}`
  }
  return next
}

function copyAnswerShortcutLabels(): Pick<
  Record<keyof ShortcutMap, string>,
  | `copyAnswer${AnswerIndex}`
  | `copyAnswerPlain${AnswerIndex}`
  | `copyAnswerCode${AnswerIndex}`
> {
  const next = {} as Pick<
    Record<keyof ShortcutMap, string>,
    | `copyAnswer${AnswerIndex}`
    | `copyAnswerPlain${AnswerIndex}`
    | `copyAnswerCode${AnswerIndex}`
  >
  for (const index of ANSWER_INDEXES) {
    const latest = latestLabel(index)
    next[`copyAnswer${index}`] = `Copy answer ${index}${latest}, markdown`
    next[`copyAnswerPlain${index}`] = `Copy answer ${index}${latest}, plain`
    next[`copyAnswerCode${index}`] = `Copy answer ${index}${latest}, code`
  }
  return next
}

function copyAnswerShortcutDescriptions(): Pick<
  Record<keyof ShortcutMap, string>,
  | `copyAnswer${AnswerIndex}`
  | `copyAnswerPlain${AnswerIndex}`
  | `copyAnswerCode${AnswerIndex}`
> {
  const next = {} as Pick<
    Record<keyof ShortcutMap, string>,
    | `copyAnswer${AnswerIndex}`
    | `copyAnswerPlain${AnswerIndex}`
    | `copyAnswerCode${AnswerIndex}`
  >
  for (const index of ANSWER_INDEXES) {
    const which = index === 1 ? 'the latest assistant reply' : `assistant reply ${index}, counting back from the latest`
    next[`copyAnswer${index}`] = `Copy ${which} as markdown.`
    next[`copyAnswerPlain${index}`] = `Copy ${which} as plain text.`
    next[`copyAnswerCode${index}`] = `Copy code from ${which}.`
  }
  return next
}

export const MODEL_OPTIONS = [
  {
    value: FAST_CHAT_MODEL,
    label: 'Fast',
    detail: 'GPT-4.1 nano',
    description: 'Quick answers. Best for short questions.',
  },
  {
    value: INTELLIGENT_CHAT_MODEL,
    label: 'Intelligent',
    detail: 'GPT-4.1',
    description: 'Full GPT-4.1. Coding challenges, interviews, and harder problems.',
  },
] as const

export type ChatModelId = (typeof MODEL_OPTIONS)[number]['value']

export function resolveChatModel(value?: string): ChatModelId {
  return MODEL_OPTIONS.some((option) => option.value === value) ? (value as ChatModelId) : FAST_CHAT_MODEL
}

export function toggleChatModel(value?: string): ChatModelId {
  return resolveChatModel(value) === INTELLIGENT_CHAT_MODEL ? FAST_CHAT_MODEL : INTELLIGENT_CHAT_MODEL
}

export function chatModelLabel(value?: string) {
  const option = MODEL_OPTIONS.find((item) => item.value === resolveChatModel(value))
  return option ? `${option.label} · ${option.detail}` : 'Fast · GPT-4.1 nano'
}

export const RESPONSE_TOKEN_LIMITS = {
  short: 400,
  medium: 1200,
  long: 3200,
} as const

export const SCREEN_ASK_PROMPT =
  'Answer from this screenshot. Read the latest interviewer question, coding task, or prompt on screen and output the words or code the user should use now, in first person as them. Ignore recording, stop-sharing, browser chrome, and this app. Do not restate the question. Greetings count as questions.'

export const REALTIME_ASK_PROMPT =
  'Answer from this live transcript. If there is a question, interview prompt, coding task, or anything to solve, output the words or code to use immediately. Concise. No coaching wrapper.'

export const QUICK_ACTIONS = [
  {
    id: 'answer',
    label: 'Answer',
    prompt:
      'Answer this interview question as the candidate in first person. Concise and spoken, ready to say out loud. No coaching. Do not restate the question.\n\nQuestion:\n',
  },
  {
    id: 'star',
    label: 'STAR',
    prompt:
      'Answer this behavioral interview question in first person using STAR (Situation, Task, Action, Result). Keep it tight and spoken. No coaching.\n\nQuestion:\n',
  },
  {
    id: 'code',
    label: 'Code',
    prompt:
      'Solve this coding interview problem. Output working code the candidate can type now. Add brief complexity only if useful. No lecture and no coaching wrapper.\n\nProblem:\n',
  },
  {
    id: 'explain',
    label: 'Explain',
    prompt:
      'Explain this as an interview answer: clear, structured, and short enough to say out loud. Use first person where it fits. No coaching.\n\nTopic:\n',
  },
  {
    id: 'design',
    label: 'Design',
    prompt:
      'Answer this system-design interview prompt. Cover requirements, approach, and key tradeoffs. First person, concise, spoken. No coaching.\n\nPrompt:\n',
  },
] as const

export type QuickActionId = (typeof QUICK_ACTIONS)[number]['id']

export function applyQuickActionPrompt(id: QuickActionId | null | undefined, message: string) {
  const action = QUICK_ACTIONS.find((item) => item.id === id)
  if (!action) return message
  const body = message.trim()
  return body ? `${action.prompt}${body}` : action.prompt.trim()
}
