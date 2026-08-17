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
const SERVER_URL = config.serverUrl

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
  await shell.openExternal(url)
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
  const session: AuthSession = { token, userId: data.userId, email: data.email }
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
  return credentials.getSession()
}

export async function clearSession(credentials: CredentialStore): Promise<void> {
  await credentials.clearSession()
}

export function registerProtocol(): void {
  const scheme = 'tudso'
  if (process.defaultApp) {
    const appPath = path.resolve(process.argv[1] ?? '.')
    app.removeAsDefaultProtocolClient(scheme)
    app.removeAsDefaultProtocolClient(scheme, process.execPath, [process.argv[1] ?? '.'])
    app.setAsDefaultProtocolClient(scheme, process.execPath, [appPath])
    return
  }
  app.setAsDefaultProtocolClient(scheme)
}
