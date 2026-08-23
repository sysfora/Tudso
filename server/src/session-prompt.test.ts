import { describe, expect, it } from 'vitest'
import {
  clearSessionPrompts,
  forgetSessionPrompt,
  getSessionPrompt,
  rememberSessionPrompt,
} from './session-prompt.js'

describe('session prompt cache', () => {
  it('stores a prompt once per user conversation', () => {
    clearSessionPrompts()
    rememberSessionPrompt('u1', 'c1', 'base prompt')
    expect(getSessionPrompt('u1', 'c1')).toBe('base prompt')
    expect(getSessionPrompt('u1', 'c2')).toBeUndefined()
    expect(getSessionPrompt('u2', 'c1')).toBeUndefined()
  })

  it('can forget a cached prompt', () => {
    clearSessionPrompts()
    rememberSessionPrompt('u1', 'c1', 'base prompt')
    forgetSessionPrompt('u1', 'c1')
    expect(getSessionPrompt('u1', 'c1')).toBeUndefined()
  })
})
