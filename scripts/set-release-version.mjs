import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writeJson(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

function bumpPatch(version) {
  const parts = String(version).replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0)
  while (parts.length < 3) parts.push(0)
  parts[2] += 1
  return parts.slice(0, 3).join('.')
}

function resolveVersion() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--print-only' && arg !== '--apply')
  if (args[0]) return args[0].replace(/^v/, '')
  if (process.env.RELEASE_VERSION?.trim()) return process.env.RELEASE_VERSION.trim().replace(/^v/, '')
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME.replace(/^v/, '')
  }
  return bumpPatch(readJson(join(root, 'package.json')).version)
}

function setPackageVersion(file, version) {
  const pkg = readJson(file)
  pkg.version = version
  writeJson(file, pkg)
}

function setLockVersion(file, version) {
  try {
    const lock = readJson(file)
    lock.version = version
    if (lock.packages?.['']) lock.packages[''].version = version
    writeJson(file, lock)
  } catch {
    // lockfile is optional in some checkouts
  }
}

function setEnvVersion(file, version) {
  let text = readFileSync(file, 'utf8')
  text = text.replace(/^APP_VERSION=.*$/m, `APP_VERSION=${version}`)
  writeFileSync(file, text)
}

const version = resolveVersion()
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid version: ${version}`)
  process.exit(1)
}

if (!process.argv.includes('--print-only')) {
  setPackageVersion(join(root, 'package.json'), version)
  setLockVersion(join(root, 'package-lock.json'), version)
  setPackageVersion(join(root, 'server/package.json'), version)
  setLockVersion(join(root, 'server/package-lock.json'), version)
  writeFileSync(join(root, 'src/shared/app-version.ts'), `export const APP_VERSION = '${version}'\n`)
  setEnvVersion(join(root, '.env.example'), version)
  setEnvVersion(join(root, 'server/.env.example'), version)
}

console.log(version)
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\n`)
}
