import { describe, expect, it } from 'vitest'
import { findOAuthProvider, generateAuthState, generateDesktopToken, verifyAuthState } from './auth.js'

describe('auth', () => {
  it('finds Google from the current PocketBase oauth2 list', () => {
    const google = findOAuthProvider(
      {
        oauth2: {
          providers: [{ name: 'google', authURL: 'https://accounts.google.com/o/oauth2/auth?redirect_uri=', codeVerifier: 'pkce' }],
        },
      },
      'google',
    )
    expect(google?.codeVerifier).toBe('pkce')
  })

  it('does not throw when PocketBase omits authProviders', () => {
    expect(findOAuthProvider({}, 'google')).toBeNull()
    expect(findOAuthProvider({ oauth2: { providers: [] } }, 'google')).toBeNull()
  })

  it('generates a unique state and verifier', () => {
    const { state, codeVerifier, url } = generateAuthState()
    expect(state).toHaveLength(64)
    expect(codeVerifier).toHaveLength(64)
    expect(url).toContain(state)
    expect(url).toContain('/login')
    expect(url).not.toContain('/auth/desktop')
  })

  it('verifies a recently created state', () => {
    const { state } = generateAuthState()
    expect(verifyAuthState(state)).toBeTruthy()
  })

  it('rejects an unknown state', () => {
    expect(verifyAuthState('unknown-state')).toBeNull()
  })

  it('generates a desktop token with expiration', () => {
    const session = generateDesktopToken('user-123')
    expect(session.userId).toBe('user-123')
    expect(session.token).toHaveLength(64)
    expect(session.expiresAt).toBeGreaterThan(Date.now())
  })
})
