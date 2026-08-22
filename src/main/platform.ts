import { app } from 'electron'
import path from 'node:path'

export const isWindows = process.platform === 'win32'
export const isMac = process.platform === 'darwin'
export const isLinux = process.platform === 'linux'

export function usesNativeOverlay() {
  return isWindows
}

export function applyLoginItem(enabled: boolean) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    enabled,
    path: process.execPath,
    args: process.defaultApp ? [path.resolve(process.argv[1] ?? '.')] : [],
  })
}
