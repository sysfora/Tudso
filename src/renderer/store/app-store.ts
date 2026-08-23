import { modifierCount } from '@shared/accelerator'
import { APP_VERSION } from '@shared/app-version'
import { DEFAULT_SETTINGS, DEFAULT_SHORTCUTS, normalizeShortcutMap, REALTIME_ASK_PROMPT, SCREEN_ASK_PROMPT, SHORTCUT_LABELS, applyQuickActionPrompt, resolveChatModel, type QuickActionId } from '@shared/defaults'
import { isActionableTranscript } from '@shared/transcript'
import { isPaidPlan } from '@shared/plans'
import type {
  Attachment,
  ChatMessage,
  Conversation,
  LocalProfile,
  ResumeImportResult,
  SessionContext,
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
import { snapshotLocalProfile, toPromptProfile, toPromptResume } from '@/types/api'
import { MAX_MEMORIES, mergeAutoMemories, shouldLearnFromMessage, storedUserContent } from '@shared/memory'
import { mergePromptMemories, promptResumeFromImport } from '@shared/resume-parse'
import { codeFromAnswer, markdownToPlain } from '@/lib/clipboard-format'
import { createId, isPlaceholderSessionTitle, MAX_SESSION_TITLE, sessionTitleFromChat } from '@/lib/format'

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
  quickActionId: QuickActionId | null
  appVersion: string
  updateAvailable: boolean
  latestVersion: string | null
  updateDownloadUrl: string | null
  updateError: string | null
  runningSessionId: string | null
  sessionStartedAt: number | null
  sessionEndedAtById: Record<string, number>
  sessionSetupOpen: boolean
  sessionSetupKey: number
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
  cancelSessionSetup: () => void
  startSession: (input: {
    profile: LocalProfile
    usedDefaults: boolean
    resumeFile?: { fileName: string; mimeType: string; data: ArrayBuffer }
    resumeImport?: ResumeImportResult
    memoryFacts?: string[]
  }) => Promise<void>
  selectConversation: (id: string) => void
  continueSession: (id?: string) => void
  cycleConversation: (delta: number) => void
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  sendMessage: (text?: string, options?: { fromScreen?: boolean; fromRealtime?: boolean; audioText?: string; audioSource?: 'mic' | 'system' }) => Promise<void>
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
  toggleQuickAction: (id: QuickActionId) => void
  captureScreen: () => Promise<string | null>
}

function upsert(list: Conversation[], conversation: Conversation) {
  const next = list.filter((item) => item.id !== conversation.id)
  next.unshift(conversation)
  return next.sort((a, b) => b.updatedAt - a.updatedAt)
}

function persistLocal(conversation: Conversation) {
  void desktop.conversations.save(conversation)
}

function chatHistory(messages: ChatMessage[]) {
  return messages
    .filter((item) => (item.role === 'user' || item.role === 'assistant') && item.content.trim())
    .slice(-12)
    .map((item) => ({ role: item.role as 'user' | 'assistant', content: item.content }))
}

function promptMemories(conversation?: Conversation | null) {
  const session = conversation?.context?.promptMemories
  const { memoryEnabled, memories } = useAuthStore.getState()
  const live = memoryEnabled ? memories.map((entry) => entry.text) : []
  const merged = mergePromptMemories([session, live])
  return merged.length ? merged : undefined
}

function learnFromChat(userText: string, assistantContent: string) {
  const auth = useAuthStore.getState()
  if (!auth.memoryEnabled || !auth.session?.userId) return
  const source = storedUserContent(userText)
  if (!shouldLearnFromMessage(source) || !assistantContent.trim()) return
  if (auth.memories.length >= MAX_MEMORIES && auth.memories.every((entry) => entry.source !== 'auto')) return
  void api.ai
    .extractMemory(source, assistantContent, auth.memories.map((entry) => entry.text))
    .then(async ({ facts }) => {
      if (!facts.length) return
      const merged = mergeAutoMemories(useAuthStore.getState().memories, facts)
      await useAuthStore.getState().saveMemories(merged)
    })
    .catch(() => undefined)
}

function promptProfile(conversation?: Conversation | null) {
  return toPromptProfile(conversation?.context?.profile ?? useAuthStore.getState().profile)
}

function promptResume(conversation?: Conversation | null) {
  return toPromptResume(conversation?.context?.promptResume)
}

function liveMemoryTexts() {
  return useAuthStore.getState().memories.map((entry) => entry.text)
}

function trackSession() {
  void api.usage.trackSession().catch(() => undefined)
}

async function attachDefaultContext(conversation: Conversation): Promise<Conversation> {
  if (conversation.context?.promptResume || conversation.context?.promptMemories?.length) {
    return conversation
  }
  const usedDefaults = conversation.context?.usedDefaults ?? true
  return hydrateSessionPrompt(conversation, {
    usedDefaults,
    copyDefaultResume: usedDefaults && !conversation.context?.resume,
  })
}

async function hydrateSessionPrompt(
  conversation: Conversation,
  options: { usedDefaults: boolean; copyDefaultResume: boolean },
): Promise<Conversation> {
  const userId = useAuthStore.getState().session?.userId
  let resume = conversation.context?.resume
  let imported: ResumeImportResult | null = null
  try {
    if (resume) {
      imported = await desktop.resume.parseSession(conversation.id, resume)
    } else if (options.copyDefaultResume && userId) {
      resume = (await desktop.sessions.copyDefaultResume(userId, conversation.id)) ?? undefined
      imported = resume ? await desktop.resume.parseUser(userId) : null
    }
  } catch {
    imported = null
  }
  const promptMemories = mergePromptMemories([liveMemoryTexts(), imported?.memories])
  const next: Conversation = {
    ...conversation,
    context: {
      profile: conversation.context?.profile ?? snapshotLocalProfile(useAuthStore.getState().profile),
      resume,
      promptResume: imported ? promptResumeFromImport(imported) : conversation.context?.promptResume,
      promptMemories: promptMemories.length ? promptMemories : conversation.context?.promptMemories,
      usedDefaults: options.usedDefaults,
    },
    updatedAt: Date.now(),
  }
  persistLocal(next)
  return next
}

function createLocalConversation(): Conversation {
  const now = Date.now()
  return {
    id: createId(),
    title: 'New session',
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
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
  quickActionId: null,
  appVersion: APP_VERSION,
  updateAvailable: false,
  latestVersion: null,
  updateDownloadUrl: null,
  updateError: null,
  runningSessionId: null,
  sessionStartedAt: null,
  sessionEndedAtById: {},
  sessionSetupOpen: false,
  sessionSetupKey: 0,

  hydrate: async () => {
    const [settings, shortcuts, lock, appVersion, blockedShortcuts, conversations] = await Promise.all([
      desktop.settings.get(),
      desktop.shortcuts.get(),
      desktop.app.getLockState(),
      desktop.app.getVersion(),
      desktop.shortcuts.getFailed(),
      desktop.conversations.list(),
    ])
    set({
      ready: true,
      settings: { ...settings, privacyMode: false },
      shortcuts: normalizeShortcutMap(shortcuts),
      blockedShortcuts,
      conversations,
      activeId: conversations[0]?.id ?? null,
      locked: lock.locked,
      lockEnabled: lock.enabled,
      appVersion,
    })
    void get().checkForUpdates()
  },

  toggleScreenContext: () => set((state) => ({ screenContext: !state.screenContext })),
  toggleAudioContext: () => set((state) => ({ audioContext: !state.audioContext })),
  toggleQuickAction: (id) =>
    set((state) => ({ quickActionId: state.quickActionId === id ? null : id })),
  captureScreen: async () => desktop.capture.screen(),

  loadMessages: async (id: string) => {
    const state = get()
    const conversation = state.conversations.find((item) => item.id === id)
    if (conversation?.messages.length) return
    const stored = await desktop.conversations.get(id)
    if (!stored) return
    set({ conversations: upsert(state.conversations, stored) })
  },

  setSettings: async (partial) => {
    const current = get().settings
    const nextPrivacy = partial.privacyMode ?? current.privacyMode
    const persisted = { ...partial, privacyMode: false }
    const settings = await desktop.settings.set(persisted)
    set({ settings: { ...settings, privacyMode: Boolean(nextPrivacy) } })
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
    set({ settings: { ...settings, privacyMode: false } })
  },

  setComposer: (composer) => set({ composer }),
  setAttachments: (attachments) => set({ attachments }),
  setSettingsOpen: (settingsOpen, section) =>
    set({
      settingsOpen,
      settingsSection: section ?? get().settingsSection,
      ...(settingsOpen ? { sessionSetupOpen: false } : {}),
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
        updateDownloadUrl: result.downloadUrl || null,
        updateError: null,
      })
    } catch (error) {
      set({ updateError: (error as Error).message })
    }
  },
  setLocked: (locked) => set({ locked }),
  setApiKeyConfigured: (apiKeyConfigured) => set({ apiKeyConfigured }),
  replaceSettings: (settings) => set((state) => ({
    settings: { ...settings, privacyMode: state.settings.privacyMode },
  })),
  replaceShortcuts: (shortcuts) => set({ shortcuts: normalizeShortcutMap(shortcuts) }),
  setBlockedShortcuts: (blockedShortcuts) => set({ blockedShortcuts }),

  newConversation: () => {
    if (get().runningSessionId) return
    set({
      sessionSetupOpen: true,
      sessionSetupKey: get().sessionSetupKey + 1,
      settingsOpen: false,
    })
  },

  cancelSessionSetup: () => {
    set({ sessionSetupOpen: false })
  },

  startSession: async (input) => {
    if (get().runningSessionId) return
    const conversation = createLocalConversation()
    const context: SessionContext = {
      profile: snapshotLocalProfile(input.profile),
      usedDefaults: input.usedDefaults,
    }
    const userId = useAuthStore.getState().session?.userId
    let imported = input.resumeImport ?? null
    try {
      if (input.resumeFile) {
        context.resume = await desktop.sessions.saveResume(conversation.id, input.resumeFile, imported ?? undefined)
        imported ??= await desktop.resume.parse(input.resumeFile)
      } else if (input.usedDefaults && userId) {
        context.resume = (await desktop.sessions.copyDefaultResume(userId, conversation.id)) ?? undefined
        imported ??= context.resume ? await desktop.resume.parseUser(userId) : null
      }
    } catch {
      desktop.app.notify('Resume', 'Could not save a resume for this session.')
    }
    if (input.memoryFacts?.length && userId) {
      try {
        const auth = useAuthStore.getState()
        if (!auth.memoryEnabled) await auth.setMemoryEnabled(true)
        const merged = mergeAutoMemories(useAuthStore.getState().memories, input.memoryFacts)
        await useAuthStore.getState().saveMemories(merged)
      } catch {
        desktop.app.notify('Memory', 'Could not save resume details to memory.')
      }
    }
    const promptMemories = mergePromptMemories([liveMemoryTexts(), input.memoryFacts, imported?.memories])
    context.promptResume = imported ? promptResumeFromImport(imported) : undefined
    context.promptMemories = promptMemories.length ? promptMemories : undefined
    const next: Conversation = { ...conversation, context }
    persistLocal(next)
    trackSession()
    set({
      conversations: upsert(get().conversations, next),
      activeId: next.id,
      settingsOpen: false,
      sessionSetupOpen: false,
      runningSessionId: next.id,
      sessionStartedAt: Date.now(),
    })
  },

  selectConversation: (id) => {
    if (get().runningSessionId && get().runningSessionId !== id) return
    set({ activeId: id, settingsOpen: false, sessionSetupOpen: false })
    void get().loadMessages(id)
  },

  continueSession: (id) => {
    const target = id ?? get().activeId
    if (get().runningSessionId && get().runningSessionId !== target) return
    if (!target) {
      get().newConversation()
      return
    }
    const conversation = get().conversations.find((item) => item.id === target)
    if (!conversation) return
    void attachDefaultContext(conversation).then((next) => {
      if (get().runningSessionId && get().runningSessionId !== next.id) return
      set({
        conversations: upsert(get().conversations, next),
        activeId: next.id,
        runningSessionId: next.id,
        sessionStartedAt: get().runningSessionId === next.id ? get().sessionStartedAt : Date.now(),
        settingsOpen: false,
        sessionSetupOpen: false,
      })
      void get().loadMessages(next.id)
    })
  },

  cycleConversation: (delta) => {
    if (get().runningSessionId) return
    const { conversations, activeId } = get()
    if (!conversations.length) return
    const index = Math.max(0, conversations.findIndex((item) => item.id === activeId))
    const next = conversations[(index + delta + conversations.length) % conversations.length]
    if (next) set({ activeId: next.id, settingsOpen: false, sessionSetupOpen: false })
  },

  deleteConversation: async (id) => {
    const wasActive = get().activeId === id
    const stopping = get().runningSessionId === id
    if (stopping) get().stopGeneration()
    try {
      await desktop.conversations.delete(id)
    } catch {
      desktop.app.notify('Delete session', 'Could not delete this session.')
      return
    }
    const conversations = get().conversations.filter((item) => item.id !== id)
    const nextActive = wasActive ? (conversations[0]?.id ?? null) : get().activeId
    set({
      conversations,
      activeId: nextActive,
      ...(stopping ? { runningSessionId: null, sessionStartedAt: null } : {}),
    })
    if (nextActive && wasActive) void get().loadMessages(nextActive)
  },

  renameConversation: async (id, title) => {
    const nextTitle = title.replace(/\s+/g, ' ').trim().slice(0, MAX_SESSION_TITLE)
    if (!nextTitle) return
    const conversation = get().conversations.find((item) => item.id === id)
    if (!conversation || conversation.title === nextTitle) return
    const next = { ...conversation, title: nextTitle, updatedAt: Date.now() }
    persistLocal(next)
    set({ conversations: upsert(get().conversations, next) })
  },

  abortController: null as AbortController | null,

  askFromScreen: async () => {
    if (get().generatingId) return
    const entitlement = useAuthStore.getState().entitlement
    if (!isPaidPlan(entitlement?.plan, entitlement?.status)) {
      desktop.app.notify('Answer from screen', 'Screen answers require an active subscription.')
      return
    }
    await get().sendMessage(undefined, { fromScreen: true })
  },

  sendMessage: async (text, options) => {
    const state = get()
    if (state.generatingId) return
    const entitlement = useAuthStore.getState().entitlement
    if (!isPaidPlan(entitlement?.plan, entitlement?.status)) {
      desktop.app.notify('Subscription required', 'This feature needs an active subscription.')
      return
    }
    const fromScreen = options?.fromScreen === true
    const fromRealtime = options?.fromRealtime === true
    const audioText = options?.audioText?.trim() ?? ''
    const audioSource = options?.audioSource === 'system' ? 'Computer Audio (Interviewer)' : 'Microphone (You)'
    const content = (text ?? (fromRealtime ? '' : state.composer)).trim()
    if (!fromScreen && !fromRealtime && !content && state.attachments.length === 0) return
    if (fromRealtime && !isActionableTranscript(audioText)) return
    if (!state.runningSessionId) {
      get().newConversation()
      return
    }

    const found = state.conversations.find((item) => item.id === state.runningSessionId)
    if (!found) {
      get().newConversation()
      return
    }
    const conversation = await attachDefaultContext(found)

    const captureScreen = fromScreen || (!fromScreen && !fromRealtime && state.screenContext)
    const displayContent = fromRealtime
      ? audioText
      : fromScreen
        ? content
        : content
    let apiMessage = fromScreen
      ? (content || SCREEN_ASK_PROMPT)
      : fromRealtime
        ? `${REALTIME_ASK_PROMPT}\n\nAudio source: ${audioSource}\nTranscript:\n${audioText}`
        : content
    apiMessage = applyQuickActionPrompt(state.quickActionId, apiMessage)

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

    const history = chatHistory(conversation.messages)

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
    const nextTitle = isPlaceholderSessionTitle(conversation.title)
      ? (sessionTitleFromChat(titleSource) ?? conversation.title)
      : conversation.title

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
      title: nextTitle,
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
    persistLocal(next)

    try {
      const model = resolveChatModel(get().settings.model)
      const turn = {
        message: apiMessage,
        history,
        signal: abortController.signal,
        model,
        conversationId: next.id,
        profile: promptProfile(next),
        memories: promptMemories(next),
        resume: promptResume(next),
      }
      const stream = image ? await api.ai.vision(image, turn) : await api.ai.chat(turn)
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
      persistLocal(next)
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
    const found = state.conversations.find((item) => item.id === state.activeId)
    if (!found) return
    const conversation = await attachDefaultContext(found)
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
    persistLocal(next)
    try {
      const stream = await api.ai.chat({
        message: applyQuickActionPrompt(get().quickActionId, lastUser.content),
        history: chatHistory(prior),
        signal: abortController.signal,
        model: resolveChatModel(get().settings.model),
        conversationId: next.id,
        profile: promptProfile(next),
        memories: promptMemories(next),
        resume: promptResume(next),
      })
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
    persistLocal(next)
  },

  retryLast: async () => {
    await get().regenerate()
  },

  clearConversations: async () => {
    await desktop.conversations.clear()
    set({ conversations: [], activeId: null, runningSessionId: null, sessionStartedAt: null, sessionEndedAtById: {}, sessionSetupOpen: false })
  },

  deleteLocalData: async () => {
    await desktop.app.deleteLocalData()
    useAuthStore.setState({ profile: null, onboardingComplete: false, memories: [], memoriesLoaded: true, memoryEnabled: true })
    set({
      settings: DEFAULT_SETTINGS,
      shortcuts: DEFAULT_SHORTCUTS,
      conversations: [],
      activeId: null,
      runningSessionId: null,
      sessionStartedAt: null,
      sessionEndedAtById: {},
      sessionSetupOpen: false,
      composer: '',
      attachments: [],
      apiKeyConfigured: false,
      lockEnabled: false,
      locked: false,
    })
  },

  appendStream: (conversationId, messageId, delta) => {
    let updated: Conversation | null = null
    const conversations = get().conversations.map((conversation) => {
      if (conversation.id !== conversationId) return conversation
      updated = {
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === messageId ? { ...message, content: message.content + delta } : message,
        ),
        updatedAt: Date.now(),
      }
      return updated
    })
    set({ conversations })
    if (updated) persistLocal(updated)
  },

  finishStream: async (conversationId, messageId) => {
    if (get().generatingId === messageId) set({ generatingId: null })
    const conversation = get().conversations.find((item) => item.id === conversationId)
    if (!conversation) return
    let next = conversation
    if (isPlaceholderSessionTitle(conversation.title)) {
      const assistant = conversation.messages.find((item) => item.id === messageId)
      const user = [...conversation.messages].reverse().find((item) => item.role === 'user')
      const title = sessionTitleFromChat(user?.content ?? '') ?? sessionTitleFromChat(assistant?.content ?? '')
      if (title) {
        next = { ...conversation, title, updatedAt: Date.now() }
        set({ conversations: upsert(get().conversations, next) })
      }
    }
    persistLocal(next)
    const assistant = next.messages.find((item) => item.id === messageId)
    const user = [...next.messages].reverse().find((item) => item.role === 'user')
    if (assistant?.content && user?.content && !assistant.error) {
      learnFromChat(user.content, assistant.content)
    }
  },

  failStream: async (conversationId, messageId, message) => {
    let updated: Conversation | null = null
    const conversations = get().conversations.map((conversation) => {
      if (conversation.id !== conversationId) return conversation
      updated = {
        ...conversation,
        messages: conversation.messages.map((item) =>
          item.id === messageId
            ? { ...item, content: item.content || message, error: true }
            : item,
        ),
        updatedAt: Date.now(),
      }
      return updated
    })
    set({ conversations, generatingId: get().generatingId === messageId ? null : get().generatingId })
    if (updated) persistLocal(updated)
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
