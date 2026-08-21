import { app } from 'electron'
import { mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { LocalProfile, LocalResumeMeta, LocalUserData } from '../shared/types'

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.txt', '.doc'])

export function emptyLocalProfile(): LocalProfile {
  return {
    skills: [],
    goals: [],
    communicationStyle: 'balanced',
    technicalLevel: 'intermediate',
    formal: false,
    stepByStep: true,
    examples: true,
    explainTerms: true,
  }
}

export function emptyLocalUser(): LocalUserData {
  return { complete: false, profile: emptyLocalProfile(), memories: [], memoryEnabled: true }
}

export function safeUserId(userId: string): string {
  const id = userId.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!id) throw new Error('Invalid user')
  return id
}

export function profileDir(userId: string): string {
  return join(app.getPath('userData'), 'profiles', safeUserId(userId))
}

export async function writeResumeFile(
  userId: string,
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<LocalResumeMeta> {
  const ext = ALLOWED_EXT.has(extname(fileName).toLowerCase()) ? extname(fileName).toLowerCase() : '.bin'
  const storedName = `resume${ext}`
  const dir = profileDir(userId)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, storedName), data)
  return {
    fileName,
    mimeType: mimeType || 'application/octet-stream',
    storedName,
  }
}

export async function removeResumeFile(userId: string, storedName?: string): Promise<void> {
  if (!storedName) return
  await unlink(join(profileDir(userId), storedName)).catch(() => undefined)
}

export async function removeAllProfiles(): Promise<void> {
  await rm(join(app.getPath('userData'), 'profiles'), { recursive: true, force: true })
}
