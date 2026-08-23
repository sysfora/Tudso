import { describe, expect, it } from 'vitest'
import { buildManifest, classifyInstaller, compareVersions, toLatestUpdate } from './releases.js'
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

  it('compares versions', () => {
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0)
    expect(compareVersions('v0.2.0', '0.2.0')).toBe(0)
  })
})
