import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { createUserPb, DEFAULT_USER_BILLING, ensureUserBilling, getAdminPb, getDesktopSession, getUserByEmail, getUserFromToken, storeDesktopSession } from './pocketbase.js'
import type { AuthState, DesktopSession } from './types.js'

const pendingStates = new Map<string, AuthState>()

export function generateAuthState(): { state: string; codeVerifier: string; url: string } {
  const state = crypto.randomBytes(32).toString('hex')
  const codeVerifier = crypto.randomBytes(32).toString('hex')
  pendingStates.set(state, { state, codeVerifier, createdAt: Date.now() })
  const url = new URL('/auth/desktop', config.app.url)
  url.searchParams.set('state', state)
  return { state, codeVerifier, url: url.toString() }
}

export function verifyAuthState(state: string): AuthState | null {
  const record = pendingStates.get(state)
  if (!record) return null
  if (Date.now() - record.createdAt > 10 * 60 * 1000) {
    pendingStates.delete(state)
    return null
  }
  return record
}

export function clearAuthState(state: string): void {
  pendingStates.delete(state)
}

export function generateDesktopToken(userId: string): DesktopSession {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + config.auth.sessionTtlMs
  return { userId, token, expiresAt }
}

export function createJwt(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, config.security.jwtSecret, { expiresIn: '7d' })
}

export function verifyJwt(token: string): { userId: string; email: string } | null {
  try {
    return jwt.verify(token, config.security.jwtSecret) as { userId: string; email: string }
  } catch {
    return null
  }
}

export async function authenticateWithEmailPassword(email: string, password: string): Promise<{ token: string; userId: string; email: string } | null> {
  const pb = createUserPb()
  try {
    const result = await pb.collection('users').authWithPassword(email, password)
    if (!pb.authStore.isValid) return null
    return { token: result.token, userId: result.record.id, email: result.record.email }
  } catch {
    return null
  }
}

export async function createAccount(email: string, password: string, name: string): Promise<{ token: string; userId: string; email: string } | null> {
  const pb = await getAdminPb()
  try {
    const existing = await getUserByEmail(email)
    if (existing) return null
    let record
    try {
      record = await pb.collection('users').create({
        email,
        password,
        passwordConfirm: password,
        name,
        ...DEFAULT_USER_BILLING,
      })
    } catch {
      record = await pb.collection('users').create({ email, password, passwordConfirm: password, name })
    }
    const authPb = createUserPb()
    const result = await authPb.collection('users').authWithPassword(email, password)
    return { token: result.token, userId: record.id, email: record.email }
  } catch {
    return null
  }
}

export async function getOAuthUrl(provider: 'google', state: string): Promise<string> {
  const pb = createUserPb()
  const redirectUrl = `${config.app.url}/auth/desktop/oauth/callback`
  const authMethods = (await pb.collection('users').listAuthMethods()) as unknown as { authProviders: Array<{ name: string; authUrl: string }> }
  const method = authMethods.authProviders.find((m) => m.name === provider)
  if (!method) throw new Error('OAuth provider not configured')
  const url = new URL(method.authUrl)
  url.searchParams.set('redirect_uri', redirectUrl)
  url.searchParams.set('state', `${state}:${provider}`)
  return url.toString()
}

export async function exchangeOAuthCallback(provider: 'google', code: string, _state: string): Promise<{ token: string; userId: string; email: string } | null> {
  const pb = createUserPb()
  const redirectUrl = `${config.app.url}/auth/desktop/oauth/callback`
  try {
    const result = await pb.collection('users').authWithOAuth2Code(provider, code, '', redirectUrl)
    if (result.meta?.isNew || !result.record.get('plan')) {
      await ensureUserBilling(result.record.id)
    }
    return { token: result.token, userId: result.record.id, email: result.record.email }
  } catch {
    return null
  }
}

export async function exchangeDesktopToken(pocketbaseToken: string, deviceId: string, platform: string, appVersion: string): Promise<{ desktopToken: string; userId: string; email: string } | null> {
  const user = await getUserFromToken(pocketbaseToken)
  if (!user) return null
  const session = generateDesktopToken(user.id)
  await storeDesktopSession(session)
  const { upsertDevice } = await import('./pocketbase.js')
  await upsertDevice(user.id, { deviceId, platform, appVersion, lastSeen: new Date().toISOString() })
  await ensureUserBilling(user.id)
  return { desktopToken: session.token, userId: user.id, email: user.email }
}

export function buildCallbackUrl(code: string, state: string): string {
  const url = new URL(`${config.auth.callbackScheme}://${config.auth.callbackHost}`)
  url.searchParams.set('code', code)
  url.searchParams.set('state', state)
  return url.toString()
}

export async function resolveAccessToken(token: string): Promise<{ userId: string; email: string } | null> {
  const session = await getDesktopSession(token)
  if (session) {
    try {
      const pb = await getAdminPb()
      const user = await pb.collection('users').getOne(session.userId)
      return { userId: user.id, email: user.email }
    } catch {
      return { userId: session.userId, email: '' }
    }
  }
  const jwt = verifyJwt(token)
  if (jwt) return { userId: jwt.userId, email: jwt.email }
  const pocketbaseUser = await getUserFromToken(token)
  if (pocketbaseUser) return { userId: pocketbaseUser.id, email: pocketbaseUser.email }
  return null
}
