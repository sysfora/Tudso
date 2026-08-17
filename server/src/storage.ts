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

export function isR2Configured(): boolean {
  const { bucket, accessKeyId, secretAccessKey, endpoint, accountId } = config.r2
  return Boolean(bucket && accessKeyId && secretAccessKey && (endpoint || accountId))
}

export function resumeStorageBackend(): StorageBackend {
  return isR2Configured() ? 'r2' : 'local'
}

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
    backend: resumeStorageBackend(),
    key,
    fileName: input.fileName,
    mimeType: input.mimeType,
  }
  if (stored.backend === 'r2') {
    await putR2Object(key, input.buffer, input.mimeType)
    if (config.r2.publicUrl) stored.url = `${config.r2.publicUrl.replace(/\/$/, '')}/${key}`
    return stored
  }
  await putLocalObject(key, input.buffer)
  return stored
}

export async function deleteStoredObject(stored: { backend?: StorageBackend; key?: string } | null | undefined): Promise<void> {
  if (!stored?.key) return
  const key = assertResumeKey(stored.key)
  const backend = stored.backend ?? resumeStorageBackend()
  if (backend === 'r2') {
    await deleteR2Object(key)
    return
  }
  await deleteLocalObject(key)
}

export async function readStoredObject(stored: { backend?: StorageBackend; key?: string }): Promise<{ buffer: Buffer; mimeType?: string }> {
  const key = assertResumeKey(stored.key ?? '')
  const backend = stored.backend ?? resumeStorageBackend()
  if (backend === 'r2') return readR2Object(key)
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

type R2Client = import('@aws-sdk/client-s3').S3Client
let cachedR2: R2Client | null = null

async function r2Client(): Promise<R2Client> {
  if (cachedR2) return cachedR2
  const { S3Client } = await import('@aws-sdk/client-s3')
  const endpoint = config.r2.endpoint || `https://${config.r2.accountId}.r2.cloudflarestorage.com`
  cachedR2 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  })
  return cachedR2
}

async function putR2Object(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3')
  const client = await r2Client()
  await client.send(new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }))
}

async function deleteR2Object(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
  const client = await r2Client()
  await client.send(new DeleteObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
  }))
}

async function readR2Object(key: string): Promise<{ buffer: Buffer; mimeType?: string }> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3')
  const client = await r2Client()
  const result = await client.send(new GetObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
  }))
  const bytes = await result.Body?.transformToByteArray()
  if (!bytes) throw new Error('Resume object is empty')
  return { buffer: Buffer.from(bytes), mimeType: result.ContentType }
}
