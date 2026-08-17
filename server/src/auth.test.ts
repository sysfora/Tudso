import { describe, expect, it } from 'vitest'
import { generateAuthState, generateDesktopToken, verifyAuthState } from './auth.js'

describe('auth', () => {
  it('generates a unique state and verifier', () => {
    const { state, codeVerifier, url } = generateAuthState()
    expect(state).toHaveLength(64)
    expect(codeVerifier).toHaveLength(64)
    expect(url).toContain(state)
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
