import { app } from 'electron'
import { copyFile, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
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

export function sessionResumeDir(sessionId: string): string {
  return join(app.getPath('userData'), 'session-resumes', safeUserId(sessionId))
}

export async function writeSessionResumeFile(
  sessionId: string,
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<LocalResumeMeta> {
  const ext = ALLOWED_EXT.has(extname(fileName).toLowerCase()) ? extname(fileName).toLowerCase() : '.bin'
  const storedName = `resume${ext}`
  const dir = sessionResumeDir(sessionId)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, storedName), data)
  return {
    fileName,
    mimeType: mimeType || 'application/octet-stream',
    storedName,
  }
}

export async function readUserResumeFile(userId: string, storedName: string): Promise<Buffer | null> {
  try {
    return await readFile(join(profileDir(userId), storedName))
  } catch {
    return null
  }
}

export async function readSessionResumeFile(sessionId: string, storedName: string): Promise<Buffer | null> {
  try {
    return await readFile(join(sessionResumeDir(sessionId), storedName))
  } catch {
    return null
  }
}

export async function copyUserResumeToSession(
  userId: string,
  sessionId: string,
  meta: LocalResumeMeta,
): Promise<LocalResumeMeta | undefined> {
  const source = join(profileDir(userId), meta.storedName)
  const dir = sessionResumeDir(sessionId)
  await mkdir(dir, { recursive: true })
  try {
    await copyFile(source, join(dir, meta.storedName))
    return { ...meta }
  } catch {
    return undefined
  }
}

export async function removeSessionResume(sessionId: string): Promise<void> {
  await rm(sessionResumeDir(sessionId), { recursive: true, force: true })
}

export async function removeAllSessionResumes(): Promise<void> {
  await rm(join(app.getPath('userData'), 'session-resumes'), { recursive: true, force: true })
}
