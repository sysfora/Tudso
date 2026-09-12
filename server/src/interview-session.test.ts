import { describe, expect, it } from 'vitest'
import { createInterviewSession, verifyInterviewSession } from './interview-session.js'

describe('interview sessions', () => {
  it('issues a lease for the requested session and binds it to the user', () => {
    const session = createInterviewSession('user-1', 15, 'free')
    expect(session.token).toHaveLength(64)
    expect(session.expiresAt).toBeGreaterThan(Date.now())
    expect(verifyInterviewSession(session.token, 'user-1')).toBe(true)
    expect(verifyInterviewSession(session.token, 'user-2')).toBe(false)
  })

  it('does not issue a longer free session than the plan allows', () => {
    const session = createInterviewSession('user-1', 120, 'free')
    expect(session.expiresAt - Date.now()).toBeLessThanOrEqual(15 * 60_000 + 100)
  })
})
