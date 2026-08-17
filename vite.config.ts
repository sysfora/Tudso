import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

function connectSrcFor(serverUrl: string) {
  const origin = serverUrl.replace(/\/$/, '')
  const wsOrigin = origin.replace(/^http/, 'ws')
  return [
    "'self'",
    'http://127.0.0.1:*',
    'ws://127.0.0.1:*',
    'http://localhost:*',
    'ws://localhost:*',
    origin,
    wsOrigin,
  ].join(' ')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_')
  const serverUrl = env.VITE_SERVER_URL || 'http://localhost:3000'
  const connectSrc = connectSrcFor(serverUrl)

  return {
    plugins: [
      {
        name: 'csp-connect-src',
        transformIndexHtml(html) {
          return html.replace(/connect-src [^"]+/, `connect-src ${connectSrc}`)
        },
      },
      react(),
      tailwindcss(),
    ],
    envDir: root,
    envPrefix: 'VITE_',
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(root, 'src/renderer'),
        '@shared': path.resolve(root, 'src/shared'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  }
})
