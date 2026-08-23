import { DEFAULT_SETTINGS, DEFAULT_SHORTCUTS, normalizeShortcutMap } from '@shared/defaults'
import type { ElectronAPI } from '@shared/electron-api'
import { mergeAutoMemories } from '@shared/memory'
import { mergeResumeIntoProfile, memoriesFromResume, parseResumeText, profileFromResume, clipResumeText } from '@shared/resume-parse'
import type { AppCommand, Conversation, LocalProfile, LocalUserData, MemoryEntry, ResumeImportResult, Settings, ShortcutMap } from '@shared/types'

function parseResumeInBrowser(file: { fileName: string; mimeType: string; data: ArrayBuffer }): ResumeImportResult {
  const ext = file.fileName.split('.').pop()?.toLowerCase() ?? ''
  const text =
    file.mimeType.startsWith('text/') || ext === 'txt' ? new TextDecoder().decode(file.data) : ''
  const parsed = parseResumeText(text)
  const clipped = clipResumeText(text)
  return {
    parsed,
    profile: profileFromResume(parsed),
    memories: memoriesFromResume(parsed),
    text: clipped,
    extractedChars: clipped.replace(/\s+/g, ' ').trim().length,
  }
}

function emptyLocalUser(): LocalUserData {
  return {
    complete: false,
    profile: {
      skills: [],
      goals: [],
      communicationStyle: 'balanced',
      technicalLevel: 'intermediate',
      formal: false,
      stepByStep: true,
      examples: true,
      explainTerms: true,
    },
    memories: [],
    memoryEnabled: true,
  }
}

let memory: {
  settings: Settings
  shortcuts: ShortcutMap
  conversations: Conversation[]
  users: Record<string, LocalUserData>
} = {
  settings: { ...DEFAULT_SETTINGS },
  shortcuts: { ...DEFAULT_SHORTCUTS },
  conversations: [],
  users: {},
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function createMock(): ElectronAPI {
  memory.settings = readStorage('tudso.settings', { ...DEFAULT_SETTINGS })
  memory.shortcuts = normalizeShortcutMap(readStorage('tudso.shortcuts', { ...DEFAULT_SHORTCUTS }))
  memory.conversations = readStorage('tudso.conversations', [])
  memory.users = readStorage('tudso.users', {})

  const listeners = {
    settings: new Set<(value: Settings) => void>(),
    shortcuts: new Set<(value: ShortcutMap) => void>(),
    chunk: new Set<(value: { conversationId: string; messageId: string; delta: string }) => void>(),
    done: new Set<(value: { conversationId: string; messageId: string }) => void>(),
    error: new Set<(value: { conversationId: string; messageId: string; message: string }) => void>(),
    command: new Set<(value: AppCommand) => void>(),
  }

  return {
    platform: 'win32',
    auth: {
      startLogin: async () => ({ url: 'http://localhost:3000/login?state=mock', state: 'mock' }),
      openLogin: async () => undefined,
      setSession: async () => undefined,
      getSession: async () => null,
      clearSession: async () => undefined,
      onAuthCallback: () => () => undefined,
    },
    window: {
      minimize: () => undefined,
      close: () => undefined,
      hide: () => undefined,
      setAlwaysOnTop: async (value) => value,
      setMode: async () => undefined,
      getBounds: async () => null,
      moveTo: async () => undefined,
      positionTo: async () => undefined,
      nudge: async () => undefined,
      restoreTaskbar: async () => undefined,
      setSignedInReady: async () => undefined,
      popupAppMenu: async () => undefined,
      setHideFromCaptureAllowed: async (allowed) => {
        if (!allowed && memory.settings.hideFromCapture) {
          memory.settings = { ...memory.settings, hideFromCapture: false }
          localStorage.setItem('tudso.settings', JSON.stringify(memory.settings))
          listeners.settings.forEach((fn) => fn(memory.settings))
        }
      },
      onCollapsed: () => () => undefined,
      onOverlayKey: () => () => undefined,
      onOverlayPointer: () => () => undefined,
      beginOverlayDrag: () => undefined,
      cancelOverlayDrag: () => undefined,
    },
    settings: {
      get: async () => memory.settings,
      set: async (partial) => {
        memory.settings = { ...memory.settings, ...partial }
        localStorage.setItem('tudso.settings', JSON.stringify(memory.settings))
        listeners.settings.forEach((fn) => fn(memory.settings))
        return memory.settings
      },
      onChange: (callback) => {
        listeners.settings.add(callback)
        return () => listeners.settings.delete(callback)
      },
    },
    shortcuts: {
      get: async () => memory.shortcuts,
      getFailed: async () => [],
      set: async (id, accelerator) => {
        memory.shortcuts = normalizeShortcutMap({ ...memory.shortcuts, [id]: accelerator })
        localStorage.setItem('tudso.shortcuts', JSON.stringify(memory.shortcuts))
        listeners.shortcuts.forEach((fn) => fn(memory.shortcuts))
        return memory.shortcuts
      },
      reset: async () => {
        memory.shortcuts = { ...DEFAULT_SHORTCUTS }
        localStorage.setItem('tudso.shortcuts', JSON.stringify(memory.shortcuts))
        listeners.shortcuts.forEach((fn) => fn(memory.shortcuts))
        return memory.shortcuts
      },
      suspend: () => undefined,
      onChange: (callback) => {
        listeners.shortcuts.add(callback)
        return () => listeners.shortcuts.delete(callback)
      },
      onFailed: () => () => undefined,
    },
    conversations: {
      list: async () => memory.conversations,
      get: async (id) => memory.conversations.find((item) => item.id === id) ?? null,
      save: async (conversation) => {
        const index = memory.conversations.findIndex((item) => item.id === conversation.id)
        if (index >= 0) memory.conversations[index] = conversation
        else memory.conversations.unshift(conversation)
        localStorage.setItem('tudso.conversations', JSON.stringify(memory.conversations))
      },
      delete: async (id) => {
        memory.conversations = memory.conversations.filter((item) => item.id !== id)
        localStorage.setItem('tudso.conversations', JSON.stringify(memory.conversations))
      },
      clear: async () => {
        memory.conversations = []
        localStorage.setItem('tudso.conversations', JSON.stringify(memory.conversations))
      },
    },
    profile: {
      get: async (userId) => structuredClone(memory.users[userId] ?? emptyLocalUser()),
      set: async (userId, profile: Partial<LocalProfile>) => {
        const current = memory.users[userId] ?? emptyLocalUser()
        const next: LocalUserData = {
          ...current,
          profile: {
            ...emptyLocalUser().profile,
            ...current.profile,
            ...profile,
            skills: profile.skills ?? current.profile.skills ?? [],
            goals: profile.goals ?? current.profile.goals ?? [],
          },
        }
        memory.users[userId] = next
        localStorage.setItem('tudso.users', JSON.stringify(memory.users))
        return structuredClone(next)
      },
      complete: async (userId) => {
        const current = memory.users[userId] ?? emptyLocalUser()
        const next: LocalUserData = { ...current, complete: true }
        memory.users[userId] = next
        localStorage.setItem('tudso.users', JSON.stringify(memory.users))
        return structuredClone(next)
      },
      setMemory: async (userId, patch: { entries?: MemoryEntry[]; enabled?: boolean }) => {
        const current = memory.users[userId] ?? emptyLocalUser()
        const next: LocalUserData = {
          ...emptyLocalUser(),
          ...current,
          memories: patch.entries ?? current.memories ?? [],
          memoryEnabled: patch.enabled ?? current.memoryEnabled ?? true,
        }
        memory.users[userId] = next
        localStorage.setItem('tudso.users', JSON.stringify(memory.users))
        return structuredClone(next)
      },
      saveResume: async (userId, file) => {
        const current = memory.users[userId] ?? emptyLocalUser()
        const imported = parseResumeInBrowser(file)
        const resume = { fileName: file.fileName, mimeType: file.mimeType, storedName: 'resume.bin' }
        const next: LocalUserData = {
          ...current,
          resume,
          profile: mergeResumeIntoProfile(current.profile, imported.parsed),
          memories: mergeAutoMemories(current.memories, imported.memories),
          memoryEnabled: true,
        }
        memory.users[userId] = next
        localStorage.setItem('tudso.users', JSON.stringify(memory.users))
        return structuredClone(next)
      },
      deleteResume: async (userId) => {
        const current = memory.users[userId] ?? emptyLocalUser()
        const next: LocalUserData = { ...current }
        delete next.resume
        memory.users[userId] = next
        localStorage.setItem('tudso.users', JSON.stringify(memory.users))
        return structuredClone(next)
      },
    },
    resume: {
      parse: async (file) => parseResumeInBrowser(file),
      parseUser: async (userId) => {
        const local = memory.users[userId]
        if (!local?.resume) return null
        const text = local.profile.customContext ?? ''
        const parsed = parseResumeText(text)
        return {
          parsed,
          profile: local.profile,
          memories: (local.memories ?? []).map((entry) => entry.text),
          text: clipResumeText(text),
          extractedChars: text.trim().length,
        }
      },
      parseSession: async () => null,
    },
    sessions: {
      saveResume: async (_sessionId, file) => ({
        fileName: file.fileName,
        mimeType: file.mimeType,
        storedName: 'resume.bin',
      }),
      copyDefaultResume: async (userId) => memory.users[userId]?.resume ?? null,
    },
    ai: {
      chat: (request) => {
        const text = [
          'This is a **preview response**. Sign in to use a live model.',
          '',
          'Once connected, answers can include lists, `inline code`, and tables.',
        ].join('\n')
        let index = 0
        const timer = window.setInterval(() => {
          const slice = text.slice(index, index + 4)
          index += 4
          listeners.chunk.forEach((fn) =>
            fn({ conversationId: request.conversationId, messageId: request.messageId, delta: slice }),
          )
          if (index >= text.length) {
            window.clearInterval(timer)
            listeners.done.forEach((fn) =>
              fn({ conversationId: request.conversationId, messageId: request.messageId }),
            )
          }
        }, 16)
      },
      stop: () => undefined,
      onChunk: (callback) => {
        listeners.chunk.add(callback)
        return () => listeners.chunk.delete(callback)
      },
      onDone: (callback) => {
        listeners.done.add(callback)
        return () => listeners.done.delete(callback)
      },
      onError: (callback) => {
        listeners.error.add(callback)
        return () => listeners.error.delete(callback)
      },
    },
    capture: {
      screen: async () => null,
      activeWindow: async () => null,
      region: async () => null,
    },
    audio: {
      getSources: async () => [],
      startCapture: async () => undefined,
      stopCapture: async () => undefined,
      onChunk: () => () => undefined,
    },
    app: {
      quit: () => undefined,
      openExternal: async (url) => {
        window.open(url, '_blank', 'noopener')
      },
      pickFiles: async () => [],
      pickResume: async () => null,
      confirm: (message) => window.confirm(message),
      notify: () => undefined,
      deleteLocalData: async () => {
        memory = {
          settings: { ...DEFAULT_SETTINGS },
          shortcuts: { ...DEFAULT_SHORTCUTS },
          conversations: [],
          users: {},
        }
        localStorage.clear()
      },
      getApiKeyStatus: async () => ({ configured: false, encrypted: false }),
      setApiKey: async () => ({ configured: true, encrypted: false }),
      clearApiKey: async () => ({ configured: false, encrypted: false }),
      setPin: async () => undefined,
      clearPin: async () => true,
      unlock: async () => true,
      lock: async () => undefined,
      getLockState: async () => ({ locked: false, enabled: false }),
      onCommand: (callback) => {
        listeners.command.add(callback)
        return () => listeners.command.delete(callback)
      },
      getVersion: async () => '0.1.0',
    },
  }
}

export const desktop: ElectronAPI = window.electronAPI ?? createMock()
export const isElectron = Boolean(window.electronAPI)
