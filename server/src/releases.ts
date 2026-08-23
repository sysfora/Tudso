import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { config } from './config.js'

export type ReleaseFile = {
  id: string
  platform: 'Windows' | 'macOS' | 'Linux'
  arch: string
  label: string
  fileName: string
  size: number
}

export type ReleaseManifest = {
  version: string
  releasedAt: string
  files: ReleaseFile[]
}

export type LatestUpdate = {
  channel: string
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  downloadUrl: string
  releaseNotesUrl: string
  files: Array<ReleaseFile & { url: string }>
}

const INSTALLER_EXT = new Set(['.exe', '.dmg', '.appimage'])
const RELEASE_NAME =
  /^[A-Za-z0-9._()[\] -]+\.(exe|dmg|zip|appimage|blockmap|yml|yaml|json)$/i

export function releasesDir() {
  return resolve(config.storage.releasesDir)
}

export function downloadPageUrl() {
  return `${appOrigin()}/download`
}

export function downloadFileUrl(fileName: string) {
  return `/downloads/${encodeURIComponent(fileName)}`
}

export async function ensureReleasesDir() {
  await mkdir(releasesDir(), { recursive: true })
}

export async function readReleaseManifest(): Promise<ReleaseManifest | null> {
  const dir = releasesDir()
  try {
    const raw = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as ReleaseManifest
    if (!raw?.version || !Array.isArray(raw.files)) return scanReleaseDir(dir)
    return {
      version: String(raw.version).replace(/^v/, ''),
      releasedAt: raw.releasedAt || '',
      files: raw.files.filter((file) => file?.fileName),
    }
  } catch {
    return scanReleaseDir(dir)
  }
}

export async function scanReleaseDir(dir: string): Promise<ReleaseManifest | null> {
  let names: string[] = []
  try {
    names = await readdir(dir)
  } catch {
    return null
  }
  const files: ReleaseFile[] = []
  for (const name of names) {
    const classified = classifyInstaller(name)
    if (!classified) continue
    try {
      const info = await stat(join(dir, name))
      if (!info.isFile()) continue
      files.push({ ...classified, fileName: name, size: info.size })
    } catch {
      continue
    }
  }
  if (!files.length) return null
  const version = files.map((file) => versionFromFileName(file.fileName)).find(Boolean) ?? ''
  if (!version) return null
  return { version, releasedAt: '', files }
}

export function isAllowedReleaseName(fileName: string) {
  if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return false
  return RELEASE_NAME.test(fileName)
}

export async function publishStagedRelease(version: string, stagingDir: string, destDir = releasesDir()): Promise<ReleaseManifest> {
  const releaseVersion = version.replace(/^v/, '').trim()
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(releaseVersion)) {
    throw new Error('Invalid version')
  }
  const names = (await readdir(stagingDir)).filter((name) => isAllowedReleaseName(name))
  const files = names.map((name) => ({ name, path: join(stagingDir, name) }))
  if (!files.some((file) => classifyInstaller(file.name))) {
    throw new Error('Upload at least one Windows, macOS, or Linux installer')
  }
  await mkdir(destDir, { recursive: true })
  for (const existing of await readdir(destDir)) {
    await rm(join(destDir, existing), { recursive: true, force: true })
  }
  const published: Array<{ name: string; size: number }> = []
  for (const file of files) {
    const dest = join(destDir, file.name)
    try {
      await copyFile(file.path, dest)
    } catch {
      throw new Error(`Could not store ${file.name}`)
    }
    const info = await stat(dest)
    published.push({ name: file.name, size: info.size })
  }
  const manifest = buildManifest(releaseVersion, published)
  await writeFile(join(destDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await rm(stagingDir, { recursive: true, force: true })
  return manifest
}

export function classifyInstaller(fileName: string): Omit<ReleaseFile, 'fileName' | 'size'> | null {
  const name = basename(fileName)
  const lower = name.toLowerCase()
  if (lower === 'manifest.json' || lower.endsWith('.blockmap') || lower.endsWith('.yml') || lower.endsWith('.yaml')) return null
  const ext = extname(lower)
  if (!INSTALLER_EXT.has(ext)) return null
  if (ext === '.exe') {
    return { id: 'windows', platform: 'Windows', arch: archOf(lower, 'x64'), label: 'Windows' }
  }
  if (ext === '.dmg') {
    const arm = /arm64|aarch64/.test(lower)
    return {
      id: arm ? 'mac-arm64' : 'mac-x64',
      platform: 'macOS',
      arch: arm ? 'arm64' : 'x64',
      label: arm ? 'macOS (Apple Silicon)' : 'macOS (Intel)',
    }
  }
  return { id: 'linux', platform: 'Linux', arch: archOf(lower, 'x64'), label: 'Linux' }
}

export function buildManifest(version: string, files: Array<{ name: string; size: number }>, releasedAt = new Date().toISOString()): ReleaseManifest {
  return {
    version: version.replace(/^v/, ''),
    releasedAt,
    files: files.flatMap((file) => {
      const classified = classifyInstaller(file.name)
      if (!classified) return []
      return [{ ...classified, fileName: basename(file.name), size: file.size }]
    }),
  }
}

export function toLatestUpdate(manifest: ReleaseManifest | null, currentVersion: string, channel: string): LatestUpdate {
  const latestVersion = manifest?.version || currentVersion
  const files = (manifest?.files ?? []).map((file) => ({ ...file, url: downloadFileUrl(file.fileName) }))
  return {
    channel,
    currentVersion,
    latestVersion,
    updateAvailable: Boolean(manifest?.version) && compareVersions(currentVersion, latestVersion) < 0,
    downloadUrl: downloadPageUrl(),
    releaseNotesUrl: downloadPageUrl(),
    files,
  }
}

export function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number)
  const partsB = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
    const numA = Number.isNaN(partsA[i]) ? 0 : (partsA[i] ?? 0)
    const numB = Number.isNaN(partsB[i]) ? 0 : (partsB[i] ?? 0)
    if (numA !== numB) return numA - numB
  }
  return 0
}

function archOf(name: string, fallback: string) {
  if (/arm64|aarch64/.test(name)) return 'arm64'
  if (/ia32|i386/.test(name)) return 'ia32'
  if (/x64|x86_64|amd64/.test(name)) return 'x64'
  return fallback
}

function versionFromFileName(name: string) {
  return name.match(/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/)?.[1]
}

function appOrigin() {
  return config.app.url.replace(/\/$/, '')
}
