import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'

export type StorageBackend = 'r2' | 'local'

export interface StoredObject {
  backend: StorageBackend
  key: string
  fileName: string
  mimeType: string
  url?: string
}

const SERVER_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const KEY_PATTERN = /^resumes\/[a-zA-Z0-9]+\/[0-9a-f-]{36}\.(pdf|docx|txt|doc|bin)$/i
const ALLOWED_EXT = new Set(['.pdf', '.docx', '.txt', '.doc'])

export function localStorageRoot(): string {
  const dir = config.storage.localDir
  return isAbsolute(dir) ? dir : join(SERVER_ROOT, dir)
}

export function createResumeKey(userId: string, fileName: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9]/g, '')
  if (!safeUser) throw new Error('Invalid user id')
  const ext = ALLOWED_EXT.has(extname(fileName).toLowerCase()) ? extname(fileName).toLowerCase() : '.bin'
  return `resumes/${safeUser}/${randomUUID()}${ext}`
}

export function assertResumeKey(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error('Invalid resume storage key')
  return key
}

export async function putResumeFile(input: {
  userId: string
  buffer: Buffer
  fileName: string
  mimeType: string
}): Promise<StoredObject> {
  const key = createResumeKey(input.userId, input.fileName)
  const stored: StoredObject = {
    backend: 'local',
    key,
    fileName: input.fileName,
    mimeType: input.mimeType,
  }
  await putLocalObject(key, input.buffer)
  return stored
}

export async function deleteStoredObject(stored: { backend?: StorageBackend; key?: string } | null | undefined): Promise<void> {
  if (!stored?.key || stored.backend === 'r2') return
  const key = assertResumeKey(stored.key)
  await deleteLocalObject(key)
}

export async function readStoredObject(stored: { backend?: StorageBackend; key?: string }): Promise<{ buffer: Buffer; mimeType?: string }> {
  const key = assertResumeKey(stored.key ?? '')
  return { buffer: await readLocalObject(key) }
}

export function localObjectPath(key: string): string {
  const root = resolve(localStorageRoot())
  const target = resolve(join(root, assertResumeKey(key)))
  const rel = relative(root, target)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Invalid resume storage path')
  return target
}

export function createLocalReadStream(key: string) {
  return createReadStream(localObjectPath(key))
}

async function putLocalObject(key: string, buffer: Buffer): Promise<void> {
  const filePath = localObjectPath(key)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, buffer)
}

async function deleteLocalObject(key: string): Promise<void> {
  await unlink(localObjectPath(key)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
}

async function readLocalObject(key: string): Promise<Buffer> {
  return readFile(localObjectPath(key))
}
