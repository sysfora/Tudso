import { app, nativeTheme } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DEFAULT_SETTINGS, DEFAULT_SHORTCUTS, normalizeShortcutMap } from '../shared/defaults'
import type {
  Conversation,
  LocalProfile,
  LocalResumeMeta,
  LocalUserData,
  MemoryEntry,
  ResumeImportResult,
  Settings,
  ShortcutMap,
  WindowBounds,
} from '../shared/types'
import { emptyLocalProfile, emptyLocalUser, removeAllProfiles, removeAllSessionResumes, removeResumeFile, removeSessionResume, writeResumeFile, writeSessionResumeFile, copyUserResumeToSession, readUserResumeFile, readSessionResumeFile } from './local-profile'
import { mergeAutoMemories, normalizeMemoryEntries } from '../shared/memory'
import { applyResumeImport, importResumeFromBuffer } from './resume-import'

interface PersistedState {
  settings: Settings
  shortcuts: ShortcutMap
  conversations: Conversation[]
  users: Record<string, LocalUserData>
  bounds: WindowBounds | null
}

const EMPTY_STATE: PersistedState = {
  settings: { ...DEFAULT_SETTINGS },
  shortcuts: { ...DEFAULT_SHORTCUTS },
  conversations: [],
  users: {},
  bounds: null,
}

export class AppStore {
  private filePath = ''
  private state: PersistedState = structuredClone(EMPTY_STATE)
  private writeTimer: ReturnType<typeof setTimeout> | null = null

  async init() {
    this.filePath = path.join(app.getPath('userData'), 'tudso-state.json')
    await this.load()
    this.pruneConversations()
  }

  getSettings(): Settings {
    return { ...DEFAULT_SETTINGS, ...this.state.settings, alwaysOnTop: true }
  }

  setSettings(partial: Partial<Settings>): Settings {
    this.state.settings = { ...this.state.settings, ...partial, alwaysOnTop: true }
    this.queueWrite()
    return this.getSettings()
  }

  getShortcuts(): ShortcutMap {
    return normalizeShortcutMap(this.state.shortcuts)
  }

  setShortcuts(shortcuts: ShortcutMap): ShortcutMap {
    this.state.shortcuts = normalizeShortcutMap(shortcuts)
    this.queueWrite()
    return this.getShortcuts()
  }

  listConversations(): Conversation[] {
    return this.state.conversations
      .map((conversation) => ({ ...conversation, messages: [...conversation.messages] }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getConversation(id: string): Conversation | null {
    const found = this.state.conversations.find((conversation) => conversation.id === id)
    return found ? structuredClone(found) : null
  }

  saveConversation(conversation: Conversation) {
    const index = this.state.conversations.findIndex((item) => item.id === conversation.id)
    if (index >= 0) this.state.conversations[index] = structuredClone(conversation)
    else this.state.conversations.unshift(structuredClone(conversation))
    this.queueWrite()
  }

  deleteConversation(id: string) {
    this.state.conversations = this.state.conversations.filter((item) => item.id !== id)
    void removeSessionResume(id)
    this.queueWrite()
  }

  clearConversations() {
    this.state.conversations = []
    void removeAllSessionResumes()
    this.queueWrite()
  }

  getBounds(): WindowBounds | null {
    return this.state.bounds ? { ...this.state.bounds } : null
  }

  setBounds(bounds: WindowBounds) {
    this.state.bounds = { ...bounds }
    this.queueWrite()
  }

  async deleteLocalData() {
    this.state = structuredClone(EMPTY_STATE)
    await removeAllProfiles()
    await removeAllSessionResumes()
    await this.flush()
  }

  getUserData(userId: string): LocalUserData {
    const existing = this.state.users[userId]
    if (!existing) return emptyLocalUser()
    return {
      complete: existing.complete === true,
      profile: {
        ...emptyLocalProfile(),
        ...existing.profile,
        skills: existing.profile?.skills ?? [],
        goals: existing.profile?.goals ?? [],
      },
      resume: existing.resume,
      memories: normalizeMemoryEntries(existing.memories),
      memoryEnabled: existing.memoryEnabled !== false,
    }
  }

  setUserProfile(userId: string, partial: Partial<LocalProfile>): LocalUserData {
    const current = this.getUserData(userId)
    const next: LocalUserData = {
      ...current,
      profile: {
        ...emptyLocalProfile(),
        ...current.profile,
        ...partial,
        skills: partial.skills ?? current.profile.skills ?? [],
        goals: partial.goals ?? current.profile.goals ?? [],
      },
    }
    this.state.users[userId] = next
    this.queueWrite()
    return structuredClone(next)
  }

  completeUserOnboarding(userId: string): LocalUserData {
    const current = this.getUserData(userId)
    const next: LocalUserData = { ...current, complete: true }
    this.state.users[userId] = next
    this.queueWrite()
    return structuredClone(next)
  }

  setUserMemory(userId: string, patch: { entries?: MemoryEntry[]; enabled?: boolean }): LocalUserData {
    const current = this.getUserData(userId)
    const next: LocalUserData = {
      ...current,
      memories: patch.entries !== undefined ? normalizeMemoryEntries(patch.entries) : current.memories,
      memoryEnabled: patch.enabled ?? current.memoryEnabled,
    }
    this.state.users[userId] = next
    this.queueWrite()
    return structuredClone(next)
  }

  async saveUserResume(
    userId: string,
    file: { fileName: string; mimeType: string; data: ArrayBuffer },
  ): Promise<LocalUserData> {
    const current = this.getUserData(userId)
    if (current.resume?.storedName) await removeResumeFile(userId, current.resume.storedName)
    const bytes = Buffer.isBuffer(file.data) ? file.data : Buffer.from(new Uint8Array(file.data))
    const resume = await writeResumeFile(userId, file.fileName, file.mimeType, bytes)
    const imported = await importResumeFromBuffer({ fileName: file.fileName, mimeType: file.mimeType, data: bytes })
    const next: LocalUserData = {
      ...current,
      resume,
      profile: applyResumeImport(current.profile, imported),
      memories: mergeAutoMemories(current.memories, imported.memories),
      memoryEnabled: true,
    }
    this.state.users[userId] = next
    this.queueWrite()
    return structuredClone(next)
  }

  async deleteUserResume(userId: string): Promise<LocalUserData> {
    const current = this.getUserData(userId)
    if (current.resume?.storedName) await removeResumeFile(userId, current.resume.storedName)
    const next: LocalUserData = { ...current }
    delete next.resume
    this.state.users[userId] = next
    this.queueWrite()
    return structuredClone(next)
  }

  async saveSessionResume(
    sessionId: string,
    file: { fileName: string; mimeType: string; data: ArrayBuffer },
  ): Promise<LocalResumeMeta> {
    await removeSessionResume(sessionId)
    const bytes = Buffer.isBuffer(file.data) ? file.data : Buffer.from(new Uint8Array(file.data))
    return writeSessionResumeFile(sessionId, file.fileName, file.mimeType, bytes)
  }

  async copyDefaultResumeToSession(userId: string, sessionId: string): Promise<LocalResumeMeta | null> {
    const current = this.getUserData(userId)
    if (!current.resume) return null
    const copied = await copyUserResumeToSession(userId, sessionId, current.resume)
    return copied ?? null
  }

  async parseUserResume(userId: string): Promise<ResumeImportResult | null> {
    const current = this.getUserData(userId)
    if (!current.resume) return null
    const bytes = await readUserResumeFile(userId, current.resume.storedName)
    if (!bytes) return null
    return importResumeFromBuffer({
      fileName: current.resume.fileName,
      mimeType: current.resume.mimeType,
      data: bytes,
    })
  }

  async parseSessionResume(sessionId: string, meta: LocalResumeMeta): Promise<ResumeImportResult | null> {
    const bytes = await readSessionResumeFile(sessionId, meta.storedName)
    if (!bytes) return null
    return importResumeFromBuffer({
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      data: bytes,
    })
  }

  private pruneConversations() {
    const days = this.state.settings.retentionDays
    if (!days) return
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const kept: Conversation[] = []
    for (const item of this.state.conversations) {
      if (item.updatedAt >= cutoff) kept.push(item)
      else void removeSessionResume(item.id)
    }
    this.state.conversations = kept
  }

  private async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<PersistedState>
      const parsedSettings = { ...DEFAULT_SETTINGS, ...parsed.settings }
      const savedRevision = parsed.settings?.defaultsRevision ?? 0
      const needsDefaults = savedRevision < 11
      if (savedRevision < 1) {
        parsedSettings.rememberPosition = true
        parsedSettings.rememberSize = true
      }
      if (savedRevision < 2) {
        parsedSettings.compactMode = true
      }
      if (savedRevision < 4) {
        parsedSettings.hideFromCapture = true
      }
      if (savedRevision < 5) {
        parsedSettings.showInTaskbar = false
        parsedSettings.showInTray = false
      }
      if (savedRevision < 6) {
        parsedSettings.minimizeToTray = false
      }
      if (savedRevision < 8) {
        if (!parsed.settings?.model || parsed.settings.model === 'gpt-4o-mini' || parsed.settings.model === 'o4-mini') {
          parsedSettings.model = DEFAULT_SETTINGS.model
        }
        parsedSettings.defaultsRevision = 8
      }
      if (savedRevision < 9) {
        if (parsedSettings.model !== 'gpt-4.1' && parsedSettings.model !== 'gpt-4.1-nano') {
          parsedSettings.model = DEFAULT_SETTINGS.model
        }
        parsedSettings.defaultsRevision = 9
      }
      const shortcuts =
        savedRevision < 3 ? { ...DEFAULT_SHORTCUTS } : normalizeShortcutMap(parsed.shortcuts)
      if (savedRevision < 7) {
        if (shortcuts.copyAnswerPlain8 === 'Control+Alt+F8') {
          shortcuts.copyAnswerPlain8 = DEFAULT_SHORTCUTS.copyAnswerPlain8
        }
        if (shortcuts.copyAnswerCode8 === 'Control+Alt+Shift+F8') {
          shortcuts.copyAnswerCode8 = DEFAULT_SHORTCUTS.copyAnswerCode8
        }
      }
      if (savedRevision < 10) {
        if (!shortcuts.scrollUp || shortcuts.scrollUp === 'Control+Alt+PageUp') {
          shortcuts.scrollUp = DEFAULT_SHORTCUTS.scrollUp
        }
        if (!shortcuts.scrollDown || shortcuts.scrollDown === 'Control+Alt+PageDown') {
          shortcuts.scrollDown = DEFAULT_SHORTCUTS.scrollDown
        }
        parsedSettings.defaultsRevision = 10
      }
      if (savedRevision < 11) {
        parsedSettings.privacyMode = false
        parsedSettings.defaultsRevision = 11
      }
      this.state = {
        settings: parsedSettings,
        shortcuts,
        conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
        users: parsed.users && typeof parsed.users === 'object' && !Array.isArray(parsed.users) ? parsed.users : {},
        bounds: parsed.bounds ?? null,
      }
      if (needsDefaults) this.queueWrite()
    } catch {
      this.state = structuredClone(EMPTY_STATE)
    }
  }

  private queueWrite() {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => {
      void this.flush()
    }, 250)
  }

  async flush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    const tempPath = `${this.filePath}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2), 'utf8')
    await fs.rename(tempPath, this.filePath)
  }
}

export function applyNativeTheme(theme: Settings['theme']) {
  nativeTheme.themeSource = theme
}
