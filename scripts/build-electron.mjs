import * as esbuild from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { electronDefines } from './load-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function buildElectron() {
  const define = electronDefines()
  await Promise.all([
    esbuild.build({
      absWorkingDir: root,
      entryPoints: [path.join(root, 'src/main/main.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: path.join(root, 'dist-electron/main.js'),
      external: ['electron'],
      sourcemap: true,
      packages: 'bundle',
      define,
      alias: {
        '@shared': path.join(root, 'src/shared'),
      },
    }),
    esbuild.build({
      absWorkingDir: root,
      entryPoints: [path.join(root, 'src/preload/preload.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: path.join(root, 'dist-electron/preload.cjs'),
      external: ['electron'],
      sourcemap: true,
    }),
  ])
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  await buildElectron()
}
