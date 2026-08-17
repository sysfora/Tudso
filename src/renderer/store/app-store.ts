import { modifierCount } from '@shared/accelerator'
import { DEFAULT_SETTINGS, DEFAULT_SHORTCUTS, normalizeShortcutMap, REALTIME_ASK_PROMPT, REALTIME_SCREEN_ASK_PROMPT, SCREEN_ASK_PROMPT, SHORTCUT_LABELS, resolveChatModel } from '@shared/defaults'
import { isActionableTranscript } from '@shared/transcript'
import type {
  Attachment,
  ChatMessage,
  Conversation,
  Settings,
  SettingsSection,
  ShortcutId,
  ShortcutMap,
  WindowMode,
} from '@shared/types'
import { create } from 'zustand'
import { api } from '@/lib/api'
import { desktop } from '@/lib/desktop'
import { useAuthStore } from '@/store/auth-store'
import { codeFromAnswer, markdownToPlain } from '@/lib/clipboard-format'
import { createId, makeTitle } from '@/lib/format'

interface AppState {
  ready: boolean
  settings: Settings
  shortcuts: ShortcutMap
  conversations: Conversation[]
  activeId: string | null
  generatingId: string | null
  settingsOpen: boolean
  settingsSection: SettingsSection
  sidebarCollapsed: boolean
  locked: boolean
  lockEnabled: boolean
  composer: string
  attachments: Attachment[]
  apiKeyConfigured: boolean
  recordingShortcut: ShortcutId | null
  blockedShortcuts: ShortcutId[]
  shortcutsOpen: boolean
  windowWidth: number
  windowCollapsed: boolean
  screenContext: boolean
  audioContext: boolean
  appVersion: string
  updateAvailable: boolean
  latestVersion: string | null
  updateError: string | null
  runningSessionId: string | null
  sessionStartedAt: number | null
  sessionEndedAtById: Record<string, number>
}

interface AppActions {
  hydrate: () => Promise<void>
  setSettings: (partial: Partial<Settings>) => Promise<void>
  setShortcut: (id: ShortcutId, accelerator: string) => Promise<void>
  resetShortcuts: () => Promise<void>
  resetSettings: () => Promise<void>
  setComposer: (value: string) => void
  setAttachments: (files: Attachment[]) => void
  setSettingsOpen: (open: boolean, section?: SettingsSection) => void
  setSidebarCollapsed: (value: boolean) => void
  setWindowWidth: (width: number) => void
  setWindowCollapsed: (value: boolean) => void
  setRecordingShortcut: (id: ShortcutId | null) => void
  setShortcutsOpen: (open: boolean) => void
  checkForUpdates: () => Promise<void>
  newConversation: () => void
  selectConversation: (id: string) => void
  cycleConversation: (delta: number) => void
  deleteConversation: (id: string) => Promise<void>
  sendMessage: (text?: string, options?: { fromScreen?: boolean; fromRealtime?: boolean; audioText?: string; audioSource?: 'mic' | 'system'; withScreen?: boolean }) => Promise<void>
  askFromScreen: () => Promise<void>
  stopGeneration: () => void
  endSession: () => void
  regenerate: (messageId?: string) => Promise<void>
  copyLastAnswer: (format?: 'markdown' | 'plain') => Promise<void>
  copyLastCode: () => Promise<void>
  copyAnswer: (index: number, format: 'markdown' | 'plain' | 'code') => Promise<void>
  copyPreviousPrompt: (index: number) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  retryLast: () => Promise<void>
  clearConversations: () => Promise<void>
  deleteLocalData: () => Promise<void>
  appendStream: (conversationId: string, messageId: string, delta: string) => void
  finishStream: (conversationId: string, messageId: string) => Promise<void>
  failStream: (conversationId: string, messageId: string, message: string) => Promise<void>
  setLocked: (locked: boolean) => void
  setApiKeyConfigured: (value: boolean) => void
  replaceSettings: (settings: Settings) => void
  replaceShortcuts: (shortcuts: ShortcutMap) => void
  setBlockedShortcuts: (ids: ShortcutId[]) => void
  abortController: AbortController | null
  loadMessages: (id: string) => Promise<void>
  toggleScreenContext: () => void
  toggleAudioContext: () => void
  captureScreen: () => Promise<string | null>
}

function upsert(list: Conversation[], conversation: Conversation) {
  const next = list.filter((item) => item.id !== conversation.id)
  next.unshift(conversation)
  return next.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  shortcuts: DEFAULT_SHORTCUTS,
  conversations: [],
  activeId: null,
  generatingId: null,
  settingsOpen: false,
  settingsSection: 'general',
  sidebarCollapsed: false,
  locked: false,
  lockEnabled: false,
  composer: '',
  attachments: [],
  apiKeyConfigured: false,
  recordingShortcut: null,
  blockedShortcuts: [],
  shortcutsOpen: false,
  windowWidth: 520,
  windowCollapsed: false,
  screenContext: false,
  audioContext: false,
  appVersion: '0.1.0',
  updateAvailable: false,
  latestVersion: null,
  updateError: null,
  runningSessionId: null,
  sessionStartedAt: null,
  sessionEndedAtById: {},

  hydrate: async () => {
    const [settings, shortcuts, lock, appVersion, blockedShortcuts] = await Promise.all([
      desktop.settings.get(),
      desktop.shortcuts.get(),
      desktop.app.getLockState(),
      desktop.app.getVersion(),
      desktop.shortcuts.getFailed(),
    ])
    try {
      const remote = await api.conversations.list()
      const conversations: Conversation[] = remote.map((item) => ({
        id: item.id,
        title: item.title,
        createdAt: new Date(item.created).getTime(),
        updatedAt: new Date(item.updated).getTime(),
        messages: [],
      }))
      set({
        ready: true,
        settings,
        shortcuts: normalizeShortcutMap(shortcuts),
        blockedShortcuts,
        conversations,
        activeId: conversations[0]?.id ?? null,
        locked: lock.locked,
        lockEnabled: lock.enabled,
        appVersion,
      })
      void get().checkForUpdates()
    } catch {
      set({
        ready: true,
        settings,
        shortcuts: normalizeShortcutMap(shortcuts),
        blockedShortcuts,
        conversations: [],
        activeId: null,
        locked: lock.locked,
        lockEnabled: lock.enabled,
        appVersion,
      })
    }
  },

  toggleScreenContext: () => set((state) => ({ screenContext: !state.screenContext })),
  toggleAudioContext: () => set((state) => ({ audioContext: !state.audioContext })),
  captureScreen: async () => desktop.capture.screen(),

  loadMessages: async (id: string) => {
    const state = get()
    const conversation = state.conversations.find((item) => item.id === id)
    if (!conversation || conversation.messages.length > 0) return
    try {
      const remote = await api.conversations.getMessages(id)
      const messages: ChatMessage[] = remote.map((item) => ({
        id: item.id,
        role: item.role as 'user' | 'assistant',
        content: item.content,
        createdAt: new Date(item.created).getTime(),
      }))
      const next = { ...conversation, messages }
      set({ conversations: upsert(state.conversations, next) })
    } catch {
      // ignore
    }
  },

  setSettings: async (partial) => {
    const settings = await desktop.settings.set(partial)
    set({ settings })
  },

  setShortcut: async (id, accelerator) => {
    const error = validateShortcut(get().shortcuts, id, accelerator)
    if (error) throw new Error(error)
    const shortcuts = await desktop.shortcuts.set(id, accelerator)
    desktop.shortcuts.suspend(false)
    const blocked = await desktop.shortcuts.getFailed()
    set({ shortcuts: normalizeShortcutMap(shortcuts), blockedShortcuts: blocked, recordingShortcut: null })
  },

  resetShortcuts: async () => {
    const shortcuts = await desktop.shortcuts.reset()
    const blocked = await desktop.shortcuts.getFailed()
    set({ shortcuts: normalizeShortcutMap(shortcuts), recordingShortcut: null, blockedShortcuts: blocked })
    desktop.shortcuts.suspend(false)
  },

  resetSettings: async () => {
    const settings = await desktop.settings.set({ ...DEFAULT_SETTINGS })
    set({ settings })
  },

  setComposer: (composer) => set({ composer }),
  setAttachments: (attachments) => set({ attachments }),
  setSettingsOpen: (settingsOpen, section) =>
    set({
      settingsOpen,
      settingsSection: section ?? get().settingsSection,
    }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setWindowWidth: (windowWidth) => set({ windowWidth }),
  setWindowCollapsed: (windowCollapsed) => set({ windowCollapsed }),
  setRecordingShortcut: (recordingShortcut) => {
    desktop.shortcuts.suspend(Boolean(recordingShortcut))
    set({ recordingShortcut })
  },
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  checkForUpdates: async () => {
    const { appVersion, settings } = get()
    try {
      const result = await api.updates.latest(appVersion, settings.releaseChannel)
      set({
        updateAvailable: result.updateAvailable,
        latestVersion: result.latestVersion,
        updateError: null,
      })
    } catch (error) {
      set({ updateError: (error as Error).message })
    }
  },
  setLocked: (locked) => set({ locked }),
  setApiKeyConfigured: (apiKeyConfigured) => set({ apiKeyConfigured }),
  replaceSettings: (settings) => set({ settings }),
  replaceShortcuts: (shortcuts) => set({ shortcuts: normalizeShortcutMap(shortcuts) }),
  setBlockedShortcuts: (blockedShortcuts) => set({ blockedShortcuts }),

  newConversation: async () => {
    if (get().runningSessionId) return
    const remote = await api.conversations.create('New session')
    const conversation: Conversation = {
      id: remote.id,
      title: remote.title,
      createdAt: new Date(remote.created).getTime(),
      updatedAt: new Date(remote.updated).getTime(),
      messages: [],
    }
    set({
      conversations: upsert(get().conversations, conversation),
      activeId: conversation.id,
      composer: '',
      attachments: [],
      settingsOpen: false,
      runningSessionId: conversation.id,
      sessionStartedAt: Date.now(),
    })
  },

  selectConversation: (id) => {
    set({ activeId: id, settingsOpen: false })
    void get().loadMessages(id)
  },

  cycleConversation: (delta) => {
    const { conversations, activeId } = get()
    if (!conversations.length) return
    const index = Math.max(0, conversations.findIndex((item) => item.id === activeId))
    const next = conversations[(index + delta + conversations.length) % conversations.length]
    if (next) set({ activeId: next.id, settingsOpen: false })
  },

  deleteConversation: async (id) => {
    await api.conversations.delete(id)
    const conversations = get().conversations.filter((item) => item.id !== id)
    const stopping = get().runningSessionId === id
    set({
      conversations,
      activeId: get().activeId === id ? (conversations[0]?.id ?? null) : get().activeId,
      ...(stopping ? { runningSessionId: null, sessionStartedAt: null } : {}),
    })
  },

  abortController: null as AbortController | null,

  askFromScreen: async () => {
    if (get().generatingId) return
    if (!useAuthStore.getState().entitlement?.screenAnalysis) {
      desktop.app.notify('Answer from screen', 'Screen analysis is not available on your plan.')
      return
    }
    await get().sendMessage(undefined, { fromScreen: true })
  },

  sendMessage: async (text, options) => {
    const state = get()
    if (state.generatingId) return
    const fromScreen = options?.fromScreen === true
    const fromRealtime = options?.fromRealtime === true
    const withScreen = options?.withScreen === true
    const audioText = options?.audioText?.trim() ?? ''
    const audioSource = options?.audioSource === 'system' ? 'Computer Audio (Interviewer)' : 'Microphone (You)'
    const content = (text ?? (fromRealtime ? '' : state.composer)).trim()
    if (!fromScreen && !fromRealtime && !content && state.attachments.length === 0) return
    if (fromRealtime && !isActionableTranscript(audioText)) return

    const captureScreen = fromScreen || (fromRealtime && withScreen) || (!fromScreen && !fromRealtime && state.screenContext)
    const displayContent = fromRealtime
      ? audioText
      : fromScreen
        ? content
        : content
    const apiMessage = fromScreen
      ? (content || SCREEN_ASK_PROMPT)
      : fromRealtime
        ? `${withScreen ? REALTIME_SCREEN_ASK_PROMPT : REALTIME_ASK_PROMPT}\n\nAudio source: ${audioSource}\nTranscript:\n${audioText}`
        : content

    if (captureScreen) set({ generatingId: 'capturing' })

    let image: string | null = null
    if (captureScreen) {
      image = await desktop.capture.screen()
      if (!image) {
        set({ generatingId: null })
        desktop.app.notify('Answer from screen', 'Screen capture failed or was denied.')
        return
      }
    }

    let conversation = state.runningSessionId
      ? state.conversations.find((item) => item.id === state.runningSessionId)
      : state.conversations.find((item) => item.id === get().activeId)
    if (!conversation) {
      if (state.runningSessionId) return
      const remote = await api.conversations.create('New session')
      conversation = {
        id: remote.id,
        title: remote.title,
        createdAt: new Date(remote.created).getTime(),
        updatedAt: new Date(remote.updated).getTime(),
        messages: [],
      }
    }

    const screenshot = image
      ? {
          id: createId(),
          name: 'Screenshot',
          mime: 'image/png',
          size: image.length,
          dataUrl: image,
        }
      : null
    const attachments = fromRealtime
      ? (screenshot ? [screenshot] : [])
      : [...state.attachments, ...(screenshot ? [screenshot] : [])]
    const titleSource = displayContent || (screenshot ? 'Answer from screen' : 'New session')

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: displayContent,
      createdAt: Date.now(),
      ...(attachments.length ? { attachments } : {}),
    }
    const assistantMessage: ChatMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    }

    const next: Conversation = {
      ...conversation,
      title: conversation.messages.length === 0 ? makeTitle(titleSource) : conversation.title,
      messages: [...conversation.messages, userMessage, assistantMessage],
      updatedAt: Date.now(),
    }

    const abortController = new AbortController()
    get().abortController = abortController

    set({
      conversations: upsert(get().conversations, next),
      activeId: next.id,
      composer: fromRealtime ? get().composer : '',
      attachments: fromRealtime ? get().attachments : [],
      generatingId: assistantMessage.id,
      runningSessionId: next.id,
      sessionStartedAt: get().sessionStartedAt ?? Date.now(),
    })

    try {
      const model = resolveChatModel(get().settings.model)
      const stream = image
        ? await api.ai.vision(image, apiMessage, next.id, abortController.signal, model)
        : await api.ai.chat(apiMessage, next.id, abortController.signal, model)
      if (!stream) throw new Error('No response stream')
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let done = false
      while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone
        if (value) {
          const delta = decoder.decode(value, { stream: true })
          get().appendStream(next.id, assistantMessage.id, delta)
        }
      }
      if (!abortController.signal.aborted) {
        await get().finishStream(next.id, assistantMessage.id)
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      await get().failStream(next.id, assistantMessage.id, (error as Error).message)
    } finally {
      get().abortController = null
    }
  },

  stopGeneration: () => {
    get().abortController?.abort()
    const { activeId, generatingId, conversations } = get()
    if (!generatingId) return
    const conversation = conversations.find((item) => item.id === activeId)
    if (conversation) {
      const messages = conversation.messages.map((message) =>
        message.id === generatingId && !message.content
          ? { ...message, content: 'Generation stopped.', error: true }
          : message,
      )
      const next = { ...conversation, messages, updatedAt: Date.now() }
      set({ conversations: upsert(conversations, next), generatingId: null })
      return
    }
    set({ generatingId: null })
  },

  endSession: () => {
    const id = get().runningSessionId
    if (!id) return
    get().stopGeneration()
    set({
      runningSessionId: null,
      sessionStartedAt: null,
      sessionEndedAtById: {
        ...get().sessionEndedAtById,
        [id]: Date.now(),
      },
    })
  },

  regenerate: async (messageId) => {
    const state = get()
    if (state.generatingId) return
    const conversation = state.conversations.find((item) => item.id === state.activeId)
    if (!conversation) return
    const targetId = messageId ?? [...conversation.messages].reverse().find((item) => item.role === 'assistant')?.id
    if (!targetId) return
    const index = conversation.messages.findIndex((item) => item.id === targetId)
    const prior = conversation.messages.slice(0, index)
    const lastUser = [...prior].reverse().find((item) => item.role === 'user')
    if (!lastUser) return
    const assistantMessage: ChatMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    }
    const next: Conversation = {
      ...conversation,
      messages: [...prior, assistantMessage],
      updatedAt: Date.now(),
    }
    const abortController = new AbortController()
    get().abortController = abortController
    set({
      conversations: upsert(state.conversations, next),
      generatingId: assistantMessage.id,
    })
    try {
      const stream = await api.ai.chat(lastUser.content, next.id, abortController.signal, resolveChatModel(get().settings.model))
      if (!stream) throw new Error('No response stream')
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let done = false
      while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone
        if (value) {
          const delta = decoder.decode(value, { stream: true })
          get().appendStream(next.id, assistantMessage.id, delta)
        }
      }
      if (!abortController.signal.aborted) {
        await get().finishStream(next.id, assistantMessage.id)
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      await get().failStream(next.id, assistantMessage.id, (error as Error).message)
    } finally {
      get().abortController = null
    }
  },

  copyLastAnswer: async (format = 'markdown') => {
    await get().copyAnswer(1, format)
  },

  copyLastCode: async () => {
    await get().copyAnswer(1, 'code')
  },

  copyAnswer: async (index, format) => {
    const conversation = get().conversations.find((item) => item.id === get().activeId)
    const answers = [...(conversation?.messages ?? [])]
      .filter((item) => item.role === 'assistant' && item.content)
      .reverse()
    const answer = answers[index - 1]
    if (!answer) return
    const text =
      format === 'plain'
        ? markdownToPlain(answer.content)
        : format === 'code'
          ? (codeFromAnswer(answer.content) ?? answer.content)
          : answer.content
    await navigator.clipboard.writeText(text)
  },

  copyPreviousPrompt: async (index) => {
    const conversation = get().conversations.find((item) => item.id === get().activeId)
    const prompts = [...(conversation?.messages ?? [])].filter((item) => item.role === 'user' && item.content).reverse()
    const prompt = prompts[index - 1]
    if (!prompt) return
    await navigator.clipboard.writeText(prompt.content)
  },

  deleteMessage: async (messageId) => {
    const state = get()
    const conversation = state.conversations.find((item) => item.id === state.activeId)
    if (!conversation) return
    const next = {
      ...conversation,
      messages: conversation.messages.filter((item) => item.id !== messageId),
      updatedAt: Date.now(),
    }
    set({ conversations: upsert(state.conversations, next) })
  },

  retryLast: async () => {
    await get().regenerate()
  },

  clearConversations: async () => {
    const conversations = get().conversations
    await Promise.all(conversations.map((c) => api.conversations.delete(c.id)))
    set({ conversations: [], activeId: null, runningSessionId: null, sessionStartedAt: null, sessionEndedAtById: {} })
  },

  deleteLocalData: async () => {
    await desktop.app.deleteLocalData()
    set({
      settings: DEFAULT_SETTINGS,
      shortcuts: DEFAULT_SHORTCUTS,
      conversations: [],
      activeId: null,
      runningSessionId: null,
      sessionStartedAt: null,
      sessionEndedAtById: {},
      composer: '',
      attachments: [],
      apiKeyConfigured: false,
      lockEnabled: false,
      locked: false,
    })
  },

  appendStream: (conversationId, messageId, delta) => {
    const conversations = get().conversations.map((conversation) => {
      if (conversation.id !== conversationId) return conversation
      return {
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === messageId ? { ...message, content: message.content + delta } : message,
        ),
        updatedAt: Date.now(),
      }
    })
    set({ conversations })
  },

  finishStream: async (_conversationId, messageId) => {
    if (get().generatingId === messageId) set({ generatingId: null })
  },

  failStream: async (conversationId, messageId, message) => {
    const conversations = get().conversations.map((conversation) => {
      if (conversation.id !== conversationId) return conversation
      return {
        ...conversation,
        messages: conversation.messages.map((item) =>
          item.id === messageId
            ? { ...item, content: item.content || message, error: true }
            : item,
        ),
        updatedAt: Date.now(),
      }
    })
    set({ conversations, generatingId: get().generatingId === messageId ? null : get().generatingId })
  },
}))

export function activeConversation(state: AppState) {
  return state.conversations.find((item) => item.id === state.activeId) ?? null
}

export function windowModeFromWidth(width: number): WindowMode {
  if (width >= 1000) return 'expanded'
  if (width >= 720) return 'normal'
  return 'compact'
}

const RESERVED_SHORTCUTS = new Set([
  'CommandOrControl+C',
  'CommandOrControl+V',
  'CommandOrControl+X',
  'CommandOrControl+A',
  'CommandOrControl+Z',
  'CommandOrControl+Y',
  'CommandOrControl+S',
  'CommandOrControl+P',
  'CommandOrControl+F',
  'CommandOrControl+T',
  'CommandOrControl+W',
  'CommandOrControl+O',
  'Control+C',
  'Control+V',
  'Control+X',
  'Control+A',
  'Control+Z',
  'Control+Y',
  'Control+S',
  'Control+P',
  'Control+F',
  'Control+T',
  'Control+W',
  'Control+O',
  'Command+C',
  'Command+V',
  'Command+X',
  'Command+A',
  'Command+Z',
  'Command+Y',
  'Command+S',
  'Command+P',
  'Command+F',
  'Command+T',
  'Command+W',
  'Command+O',
  'Command+Q',
  'Command+H',
  'Command+M',
  'Command+Space',
  'Command+Tab',
  'Alt+Tab',
  'Alt+F4',
  'Control+Alt+Delete',
  'Control+Shift+Esc',
  'CommandOrControl+Shift+Esc',
  'CommandOrControl+Shift+N',
  'CommandOrControl+Shift+T',
])

export function validateShortcut(
  shortcuts: ShortcutMap,
  id: ShortcutId,
  accelerator: string,
): string | null {
  if (!accelerator) return 'Shortcut cannot be empty.'

  if (modifierCount(accelerator) < 2) {
    return 'Use two modifiers, such as Ctrl+Alt, so it will not clash with other apps.'
  }

  for (const existingId of Object.keys(shortcuts) as ShortcutId[]) {
    if (existingId === id) continue
    const existingAccelerator = shortcuts[existingId]
    if (existingAccelerator.toLowerCase() === accelerator.toLowerCase()) {
      return `This shortcut is already used by ${SHORTCUT_LABELS[existingId]}.`
    }
  }

  if (RESERVED_SHORTCUTS.has(accelerator)) {
    return 'This shortcut is reserved by the operating system. Pick a different one.'
  }

  return null
}
