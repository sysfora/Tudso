import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildElectron } from './build-electron.mjs'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function waitForRenderer() {
  for (;;) {
    try {
      const response = await fetch('http://127.0.0.1:5173/', { redirect: 'manual' })
      if (response.ok || response.status === 404) return
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

let child = null
let restartTimer = null
let restarting = false

function startElectron() {
  child = spawn(electronPath, [root], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: 'http://127.0.0.1:5173',
    },
  })
  child.on('exit', () => {
    child = null
  })
}

async function restartElectron() {
  if (restarting) return
  restarting = true
  if (child) {
    child.kill()
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  await buildElectron()
  startElectron()
  restarting = false
}

function scheduleRestart() {
  if (restartTimer) clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    void restartElectron()
  }, 180)
}

await waitForRenderer()
await buildElectron()
startElectron()

for (const dir of ['src/main', 'src/preload', 'src/shared']) {
  watch(path.join(root, dir), { recursive: true }, scheduleRestart)
}
