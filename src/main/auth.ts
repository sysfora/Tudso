import { app, shell } from 'electron'
import path from 'node:path'
import { CHANNELS } from '../shared/channels'
import { config } from './config'
import type { AuthSession } from '../shared/types'
import type { CredentialStore } from './credentials'
import { sendToRenderer } from './windows'

interface AuthState {
  state: string
  deviceId: string
  platform: string
  appVersion: string
}

let activeAuth: AuthState | null = null
let completionPoll: AbortController | null = null
const SERVER_URL = config.serverUrl
const SCHEME = 'tudso'

export async function startLogin(deviceId: string, platform: string, appVersion: string): Promise<{ url: string; state: string }> {
  const response = await fetch(`${SERVER_URL}/auth/desktop/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, platform, appVersion }),
  })
  if (!response.ok) throw new Error('Failed to start login')
  const { url, state } = (await response.json()) as { url: string; state: string }
  activeAuth = { state, deviceId, platform, appVersion }
  return { url, state }
}

export async function openLogin(url: string): Promise<void> {
  const parsed = new URL(url)
  const expected = new URL(SERVER_URL)
  if (parsed.origin !== expected.origin || parsed.pathname !== '/login') {
    throw new Error('Refusing to open an untrusted login URL')
  }
  await shell.openExternal(url)
}

export function pollForAuthCompletion(state: string, credentials: CredentialStore): void {
  completionPoll?.abort()
  const controller = new AbortController()
  completionPoll = controller
  const run = async () => {
    const deadline = Date.now() + 10 * 60 * 1000
    while (!controller.signal.aborted && Date.now() < deadline) {
      try {
        const response = await fetch(`${SERVER_URL}/auth/desktop/poll?state=${encodeURIComponent(state)}`, {
          signal: controller.signal,
        })
        if (response.status === 410) return
        if (response.ok) {
          const result = (await response.json()) as { status?: string; code?: string; state?: string }
          if (result.status === 'ready' && result.code && result.state) {
            await handleAuthCallback(result.code, result.state, credentials)
            return
          }
        }
      } catch {
        if (controller.signal.aborted) return
      }
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }
  void run()
}

export async function handleAuthCallback(code: string, state: string, credentials: CredentialStore): Promise<AuthSession | null> {
  const deviceId = activeAuth?.deviceId ?? `desktop-${Date.now()}`
  const platform = activeAuth?.platform ?? process.platform
  const appVersion = activeAuth?.appVersion ?? app.getVersion()
  const response = await fetch(`${SERVER_URL}/auth/desktop/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      state,
      deviceId,
      platform,
      appVersion,
    }),
  })
  if (!response.ok) return null
  const data = (await response.json()) as { token?: string; desktopToken?: string; userId: string; email: string }
  const token = data.token ?? data.desktopToken
  if (!token || !data.userId) return null
  if (activeAuth?.state === state) {
    completionPoll?.abort()
    completionPoll = null
  }
  const session: AuthSession = { token, userId: data.userId, email: data.email, deviceId }
  await credentials.setSession(session)
  activeAuth = null
  sendAuthSession(session)
  return session
}

let pendingAuthSession: AuthSession | null = null

export function sendAuthSession(session: AuthSession): void {
  pendingAuthSession = session
  sendToRenderer(CHANNELS.authCallback, session)
}

export function flushPendingAuthSession(): void {
  if (!pendingAuthSession) return
  sendToRenderer(CHANNELS.authCallback, pendingAuthSession)
}

export async function setSession(session: AuthSession, credentials: CredentialStore): Promise<void> {
  await credentials.setSession(session)
}

export async function getSession(credentials: CredentialStore): Promise<AuthSession | null> {
  const session = credentials.getSession()
  if (!session) return null
  if (session.deviceId) return session
  const deviceId = await credentials.getOrCreateDeviceId()
  const next = { ...session, deviceId }
  await credentials.setSession(next)
  return next
}

export async function clearSession(credentials: CredentialStore): Promise<void> {
  await credentials.clearSession()
}

export function registerProtocol(): void {
  if (process.defaultApp) {
    const appPath = path.resolve(process.argv[1] ?? '.')
    app.removeAsDefaultProtocolClient(SCHEME)
    app.removeAsDefaultProtocolClient(SCHEME, process.execPath, [process.argv[1] ?? '.'])
    app.setAsDefaultProtocolClient(SCHEME, process.execPath, [appPath])
    return
  }
  app.setAsDefaultProtocolClient(SCHEME)
}
