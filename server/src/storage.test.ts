import { sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertResumeKey, createResumeKey, deleteStoredObject, isR2Configured, localObjectPath, putResumeFile, readStoredObject } from './storage.js'

describe('resume storage', () => {
  it('is local when R2 is not configured', () => {
    expect(isR2Configured()).toBe(false)
  })

  it('builds a safe object key from the user id and file name', () => {
    const key = createResumeKey('abc123_user!', 'My Resume.PDF')
    expect(key).toMatch(/^resumes\/abc123user\/[0-9a-f-]{36}\.pdf$/)
    expect(assertResumeKey(key)).toBe(key)
  })

  it('rejects path traversal in storage keys', () => {
    expect(() => assertResumeKey('resumes/abc/../../../etc/passwd')).toThrow('Invalid resume storage key')
    expect(() => assertResumeKey('/etc/passwd')).toThrow('Invalid resume storage key')
  })

  it('stores and reads a resume locally when R2 is unset', async () => {
    const stored = await putResumeFile({
      userId: 'user1234567890a',
      buffer: Buffer.from('resume-bytes'),
      fileName: 'cv.pdf',
      mimeType: 'application/pdf',
    })
    expect(stored.backend).toBe('local')
    expect(stored.key).toMatch(/^resumes\/user1234567890a\/[0-9a-f-]{36}\.pdf$/)
    expect(localObjectPath(stored.key).endsWith(stored.key.split('/').join(sep))).toBe(true)
    const read = await readStoredObject(stored)
    expect(read.buffer.toString()).toBe('resume-bytes')
    await deleteStoredObject(stored)
  })
})
