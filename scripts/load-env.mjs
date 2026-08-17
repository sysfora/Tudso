import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function loadClientEnv() {
  const mode = process.env.MODE || process.env.NODE_ENV || 'development'
  const loaded = loadEnv(mode, root, 'VITE_')
  for (const [key, value] of Object.entries(loaded)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
  return {
    serverUrl: process.env.VITE_SERVER_URL ?? 'http://localhost:3000',
    appName: process.env.VITE_APP_NAME ?? 'Tudso',
  }
}

export function electronDefines() {
  const env = loadClientEnv()
  return {
    'process.env.VITE_SERVER_URL': JSON.stringify(env.serverUrl),
    'process.env.VITE_APP_NAME': JSON.stringify(env.appName),
  }
}
