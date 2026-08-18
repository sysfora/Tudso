import { describe, expect, it } from 'vitest'
import { pbQuote } from './pb-filter.js'

describe('pbQuote', () => {
  it('wraps a value in quotes', () => {
    expect(pbQuote('abc')).toBe('"abc"')
  })

  it('escapes quotes and backslashes so filter injection cannot close the string', () => {
    expect(pbQuote('a" || user!="" || deviceId="b')).toBe('"a\\" || user!=\\"\\" || deviceId=\\"b"')
    expect(pbQuote('a\\b')).toBe('"a\\\\b"')
  })
})
