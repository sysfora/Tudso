import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tokenEquals } from './middleware.js'
import { buildManifest, classifyInstaller, compareVersions, isAllowedReleaseName, publishStagedRelease, toLatestUpdate } from './releases.js'
import { config } from './config.js'

describe('release manifest', () => {
  it('classifies Windows, Mac, and Linux installers and drops page markers', () => {
    expect(classifyInstaller('Tudso-0.2.0-win-x64.exe')?.id).toBe('windows')
    expect(classifyInstaller('Tudso-0.2.0-mac-arm64.dmg')).toMatchObject({ id: 'mac-arm64', label: 'macOS (Apple Silicon)' })
    expect(classifyInstaller('Tudso-0.2.0-mac-x64.dmg')?.id).toBe('mac-x64')
    expect(classifyInstaller('Tudso-0.2.0-linux-x64.AppImage')?.id).toBe('linux')
    expect(classifyInstaller('latest.yml')).toBeNull()
    expect(classifyInstaller('Tudso-0.2.0-win-x64.exe.blockmap')).toBeNull()
  })

  it('builds a manifest and latest update payload from installer names', () => {
    const manifest = buildManifest('v0.2.0', [
      { name: 'Tudso-0.2.0-win-x64.exe', size: 80_000_000 },
      { name: 'Tudso-0.2.0-mac-arm64.dmg', size: 90_000_000 },
      { name: 'Tudso-0.2.0-linux-x64.AppImage', size: 85_000_000 },
      { name: 'latest.yml', size: 200 },
    ])
    expect(manifest.version).toBe('0.2.0')
    expect(manifest.files.map((file) => file.id)).toEqual(['windows', 'mac-arm64', 'linux'])
    const latest = toLatestUpdate(manifest, '0.1.0', 'stable')
    expect(latest.updateAvailable).toBe(true)
    expect(latest.downloadUrl).toContain('/download')
    expect(latest.files[0]?.url).toContain('/downloads/Tudso-0.2.0-win-x64.exe')
    expect(config.app.url).toBeTruthy()
  })

  it('does not advertise an update when no release has been uploaded', () => {
    const latest = toLatestUpdate(null, '1.0.0', 'stable')
    expect(latest.latestVersion).toBe('1.0.0')
    expect(latest.updateAvailable).toBe(false)
    expect(latest.files).toEqual([])
    expect(latest.downloadUrl).toContain('/download')
  })

  it('compares versions', () => {
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0)
    expect(compareVersions('v0.2.0', '0.2.0')).toBe(0)
  })

  it('accepts installer names and rejects path traversal', () => {
    expect(isAllowedReleaseName('Tudso-1.0.0-win-x64.exe')).toBe(true)
    expect(isAllowedReleaseName('latest.yml')).toBe(true)
    expect(isAllowedReleaseName('../secret.exe')).toBe(false)
    expect(isAllowedReleaseName('payload.sh')).toBe(false)
  })

  it('replaces previous installers when publishing a staged upload', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tudso-release-'))
    const staging = join(root, 'staging')
    const dest = join(root, 'dest')
    await mkdir(staging, { recursive: true })
    await mkdir(dest, { recursive: true })
    await writeFile(join(dest, 'Tudso-0.9.0-win-x64.exe'), 'old')
    await writeFile(join(staging, 'Tudso-1.0.0-win-x64.exe'), 'new-win')
    await writeFile(join(staging, 'latest.yml'), 'version: 1.0.0')
    const manifest = await publishStagedRelease('1.0.0', staging, dest)
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.files.map((file) => file.fileName)).toEqual(['Tudso-1.0.0-win-x64.exe'])
    const stored = await readFile(join(dest, 'Tudso-1.0.0-win-x64.exe'), 'utf8')
    expect(stored).toBe('new-win')
    await expect(readFile(join(dest, 'Tudso-0.9.0-win-x64.exe'))).rejects.toThrow()
    await rm(root, { recursive: true, force: true })
  })

  it('compares upload tokens in constant time', () => {
    expect(tokenEquals('abc', 'abc')).toBe(true)
    expect(tokenEquals('abc', 'abd')).toBe(false)
    expect(tokenEquals('', 'abc')).toBe(false)
    expect(tokenEquals('abc', '')).toBe(false)
  })
})
