import { describe, expect, it } from 'vitest'
import { publicAccount } from './account.js'

describe('publicAccount', () => {
  it('exposes a same-origin avatar URL and never a writable email field', () => {
    expect(publicAccount({
      userId: 'abc',
      email: 'user@example.com',
      name: 'Ada',
      avatar: 'photo.jpg',
      updated: '2026-08-21 12:00:00.000Z',
    })).toEqual({
      userId: 'abc',
      email: 'user@example.com',
      name: 'Ada',
      avatarUrl: '/me/avatar?v=2026-08-21%2012%3A00%3A00.000Z',
    })
  })

  it('omits avatarUrl when there is no file', () => {
    expect(publicAccount({
      userId: 'abc',
      email: 'user@example.com',
      name: '',
      avatar: null,
      updated: '1',
    }).avatarUrl).toBeNull()
  })
})
