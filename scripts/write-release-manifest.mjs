import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const INSTALLER_EXT = new Set(['.exe', '.dmg', '.appimage'])
const dir = process.argv[2] || 'artifacts'
const version = String(process.argv[3] || pkg.version).replace(/^v/, '')

function archOf(name, fallback) {
  if (/arm64|aarch64/.test(name)) return 'arm64'
  if (/ia32|i386/.test(name)) return 'ia32'
  if (/x64|x86_64|amd64/.test(name)) return 'x64'
  return fallback
}

function classifyInstaller(fileName) {
  const name = basename(fileName)
  const lower = name.toLowerCase()
  if (lower === 'manifest.json' || lower.endsWith('.blockmap') || lower.endsWith('.yml') || lower.endsWith('.yaml')) return null
  const ext = extname(lower)
  if (!INSTALLER_EXT.has(ext)) return null
  if (ext === '.exe') return { id: 'windows', platform: 'Windows', arch: archOf(lower, 'x64'), label: 'Windows' }
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

const files = []
for (const name of readdirSync(dir)) {
  const classified = classifyInstaller(name)
  if (!classified) continue
  const info = statSync(join(dir, name))
  if (!info.isFile()) continue
  files.push({ ...classified, fileName: name, size: info.size })
}

if (!files.length) {
  console.error(`No Windows, macOS, or Linux installers found in ${dir}`)
  process.exit(1)
}

const manifest = {
  version,
  releasedAt: new Date().toISOString(),
  files,
}
writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${join(dir, 'manifest.json')} for ${version} (${files.length} installers)`)
