import { randomUUID } from 'node:crypto'
import { safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { ApiKeyStatus, AuthSession } from '../shared/types'

interface SecretFile {
  apiKey?: string
  pin?: string
  deviceId?: string
  session?: AuthSession
}

export class CredentialStore {
  private filePath = ''
  private memory: { apiKey?: string; pin?: string; deviceId?: string; session?: AuthSession } = {}

  async init() {
    this.filePath = path.join(app.getPath('userData'), 'tudso-secrets.json')
    await this.load()
  }

  getApiKey(): string | null {
    return this.memory.apiKey ?? null
  }

  getApiKeyStatus(): ApiKeyStatus {
    return {
      configured: Boolean(this.memory.apiKey),
      encrypted: safeStorage.isEncryptionAvailable(),
    }
  }

  async setApiKey(key: string) {
    const trimmed = key.trim()
    this.memory.apiKey = trimmed || undefined
    await this.persist()
    return this.getApiKeyStatus()
  }

  async clearApiKey() {
    this.memory.apiKey = undefined
    await this.persist()
    return this.getApiKeyStatus()
  }

  hasPin() {
    return Boolean(this.memory.pin)
  }

  async setPin(pin: string) {
    this.memory.pin = pin
    await this.persist()
  }

  async clearPin() {
    this.memory.pin = undefined
    await this.persist()
  }

  async getOrCreateDeviceId(): Promise<string> {
    if (this.memory.deviceId) return this.memory.deviceId
    this.memory.deviceId = randomUUID()
    await this.persist()
    return this.memory.deviceId
  }

  verifyPin(pin: string) {
    return this.memory.pin === pin
  }

  async clearAll() {
    this.memory = {}
    await this.persist()
  }

  getSession(): AuthSession | null {
    return this.memory.session ?? null
  }

  async setSession(session: AuthSession) {
    this.memory.session = session
    if (session.deviceId) this.memory.deviceId = session.deviceId
    await this.persist()
  }

  async clearSession() {
    this.memory.session = undefined
    await this.persist()
  }

  private async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as { payload?: string }
      if (!parsed.payload) return
      if (!safeStorage.isEncryptionAvailable()) return
      const json = safeStorage.decryptString(Buffer.from(parsed.payload, 'base64'))
      const secrets = JSON.parse(json) as SecretFile
      this.memory = {
        apiKey: secrets.apiKey,
        pin: secrets.pin,
        deviceId: secrets.deviceId,
        session: secrets.session,
      }
    } catch {
      this.memory = {}
    }
  }

  private async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Operating system encryption is unavailable on this device.')
    }
    const payload = safeStorage.encryptString(JSON.stringify(this.memory)).toString('base64')
    await fs.writeFile(this.filePath, JSON.stringify({ payload }), 'utf8')
  }
}
