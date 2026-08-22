import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { createUserPb, DEFAULT_USER_BILLING, ensureUserBilling, getAdminPb, getDesktopSession, getUserByEmail, getUserFromToken, storeDesktopSession } from './pocketbase.js'
import { logError } from './log.js'
import type { AuthState, DesktopSession } from './types.js'

type OAuthProvider = {
  name: string
  authURL?: string
  authUrl?: string
  codeVerifier?: string
}

export function findOAuthProvider(
  authMethods: {
    oauth2?: { providers?: OAuthProvider[] }
    authProviders?: OAuthProvider[]
  },
  provider: string,
): OAuthProvider | null {
  const providers = authMethods.oauth2?.providers ?? authMethods.authProviders ?? []
  return providers.find((item) => item.name === provider) ?? null
}

const pendingStates = new Map<string, AuthState>()

export function generateAuthState(kind: 'desktop' | 'web' = 'desktop'): { state: string; codeVerifier: string; url: string } {
  const state = crypto.randomBytes(32).toString('hex')
  const codeVerifier = crypto.randomBytes(32).toString('hex')
  pendingStates.set(state, { state, codeVerifier, createdAt: Date.now(), kind })
  const url = new URL('/login', config.app.url)
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

export function generateDesktopToken(userId: string, deviceId?: string): DesktopSession {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + config.auth.sessionTtlMs
  return { userId, token, expiresAt, deviceId }
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

export type PasswordAuthResult = { token: string; userId: string; email: string; verified: boolean }

export async function authenticateWithEmailPassword(email: string, password: string): Promise<PasswordAuthResult | null> {
  const pb = createUserPb()
  try {
    const result = await pb.collection('users').authWithPassword(email, password)
    if (!pb.authStore.isValid) return null
    return {
      token: result.token,
      userId: result.record.id,
      email: result.record.email,
      verified: Boolean(result.record.verified),
    }
  } catch {
    return null
  }
}

export async function createAccount(email: string, password: string, name: string): Promise<PasswordAuthResult | null> {
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
    await requestEmailVerification(email)
    return { token: result.token, userId: record.id, email: record.email, verified: Boolean(result.record.verified) }
  } catch {
    return null
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const pb = createUserPb()
  try {
    await pb.collection('users').requestPasswordReset(email)
  } catch (error) {
    logError('Password reset request failed', error)
  }
}

export async function confirmPasswordReset(token: string, password: string, passwordConfirm: string): Promise<boolean> {
  const pb = createUserPb()
  try {
    await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
    return true
  } catch (error) {
    logError('Password reset confirm failed', error)
    return false
  }
}

export async function requestEmailVerification(email: string): Promise<void> {
  const pb = createUserPb()
  try {
    await pb.collection('users').requestVerification(email)
  } catch (error) {
    logError('Verification email request failed', error)
  }
}

export async function confirmEmailVerification(token: string): Promise<boolean> {
  const pb = createUserPb()
  try {
    await pb.collection('users').confirmVerification(token)
    return true
  } catch (error) {
    logError('Email verification failed', error)
    return false
  }
}

export async function confirmEmailChange(token: string, password: string): Promise<boolean> {
  const pb = createUserPb()
  try {
    await pb.collection('users').confirmEmailChange(token, password)
    return true
  } catch (error) {
    logError('Email change confirm failed', error)
    return false
  }
}

export async function getOAuthUrl(provider: 'google', state: string, oauthKind?: AuthState['kind']): Promise<string> {
  const pending = verifyAuthState(state)
  if (!pending) throw new Error('Sign-in expired. Return to Tudso and try again.')

  const pb = createUserPb()
  pending.oauthKind = oauthKind ?? pending.kind
  const redirectUrl = oauthRedirectUrl(pending.oauthKind)
  const authMethods = await pb.collection('users').listAuthMethods()
  const method = findOAuthProvider(authMethods, provider)
  const authURL = method?.authURL || method?.authUrl
  if (!method || !authURL) {
    throw new Error("Google sign-in isn't available right now. Use email instead.")
  }

  pending.codeVerifier = method.codeVerifier || pending.codeVerifier
  pendingStates.set(state, pending)

  const url = new URL(authURL)
  url.searchParams.set('redirect_uri', redirectUrl)
  url.searchParams.set('state', `${state}:${provider}`)
  return url.toString()
}

function oauthRedirectUrl(kind: AuthState['kind'] = 'desktop'): string {
  const path = kind === 'web' ? '/auth/web/oauth/callback' : '/auth/desktop/oauth/callback'
  return `${config.app.url}${path}`
}

export async function exchangeOAuthCallback(provider: 'google', code: string, state: string): Promise<PasswordAuthResult | null> {
  const pending = verifyAuthState(state)
  if (!pending) return null
  const pb = createUserPb()
  const redirectUrl = oauthRedirectUrl(pending.oauthKind ?? pending.kind)
  try {
    const result = await pb.collection('users').authWithOAuth2Code(provider, code, pending.codeVerifier, redirectUrl)
    const record = result.record as unknown as { id: string; email: string; plan?: string; verified?: boolean }
    if (result.meta?.isNew || !record.plan) {
      await ensureUserBilling(record.id)
    }
    return { token: result.token, userId: record.id, email: record.email, verified: Boolean(record.verified) }
  } catch (error) {
    logError('Google OAuth exchange failed', error)
    return null
  }
}

export async function createAppSession(
  userId: string,
  email: string,
  deviceId: string,
  platform: string,
  appVersion: string,
): Promise<{ desktopToken: string; userId: string; email: string }> {
  const session = generateDesktopToken(userId, deviceId)
  await storeDesktopSession(session)
  const { upsertDevice } = await import('./pocketbase.js')
  await upsertDevice(userId, { deviceId, platform, appVersion, lastSeen: new Date().toISOString() })
  await ensureUserBilling(userId)
  return { desktopToken: session.token, userId, email }
}

export async function exchangeDesktopToken(pocketbaseToken: string, deviceId: string, platform: string, appVersion: string): Promise<{ desktopToken: string; userId: string; email: string } | null> {
  const user = await getUserFromToken(pocketbaseToken)
  if (!user) return null
  return createAppSession(user.id, user.email, deviceId, platform, appVersion)
}

export function buildCallbackUrl(code: string, state: string): string {
  const url = new URL(`${config.auth.callbackScheme}://${config.auth.callbackHost}`)
  url.searchParams.set('code', code)
  url.searchParams.set('state', state)
  return url.toString()
}

export async function resolveAccessToken(token: string): Promise<{ userId: string; email: string; deviceId?: string } | null> {
  const session = await getDesktopSession(token)
  if (session) {
    try {
      const pb = await getAdminPb()
      const user = await pb.collection('users').getOne(session.userId)
      return { userId: user.id, email: user.email, deviceId: session.deviceId }
    } catch {
      return { userId: session.userId, email: '', deviceId: session.deviceId }
    }
  }
  const jwt = verifyJwt(token)
  if (jwt) return { userId: jwt.userId, email: jwt.email }
  const pocketbaseUser = await getUserFromToken(token)
  if (pocketbaseUser) return { userId: pocketbaseUser.id, email: pocketbaseUser.email }
  return null
}
