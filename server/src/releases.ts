import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
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
    if (!raw?.version || !Array.isArray(raw.files)) return scanReleaseDir(dir, config.updates.stable)
    return {
      version: String(raw.version).replace(/^v/, ''),
      releasedAt: raw.releasedAt || '',
      files: raw.files.filter((file) => file?.fileName),
    }
  } catch {
    return scanReleaseDir(dir, config.updates.stable)
  }
}

export async function scanReleaseDir(dir: string, version: string): Promise<ReleaseManifest | null> {
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
  return { version: version.replace(/^v/, ''), releasedAt: '', files }
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
  const latestVersion = manifest?.version || config.updates[channel as 'stable' | 'beta' | 'alpha'] || config.updates.stable
  const files = (manifest?.files ?? []).map((file) => ({ ...file, url: downloadFileUrl(file.fileName) }))
  return {
    channel,
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(currentVersion, latestVersion) < 0,
    downloadUrl: config.updates.downloadUrl || downloadPageUrl(),
    releaseNotesUrl: config.updates.releaseNotesUrl || downloadPageUrl(),
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

function appOrigin() {
  return config.app.url.replace(/\/$/, '')
}
