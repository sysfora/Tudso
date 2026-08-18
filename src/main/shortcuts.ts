import { globalShortcut } from 'electron'
import { eventMatchesAccelerator } from '../shared/accelerator'
import { CHANNELS } from '../shared/channels'
import { SHORTCUT_TAKEN_MESSAGE } from '../shared/defaults'
import { SHORTCUT_COMMANDS } from '../shared/shortcut-commands'
import type { ShortcutId, ShortcutMap } from '../shared/types'
import {
  getMainWindow,
  sendToRenderer,
  showMainWindow,
  toggleCollapsed,
  toggleMainWindow,
} from './windows'

const SHOW_FIRST = new Set<ShortcutId>([
  'newConversation',
  'endSession',
  'nextConversation',
  'previousConversation',
  'liveCopilotScreen',
  'liveCopilotAudio',
  'focusComposer',
  'openSettings',
  'openCommandPalette',
  'toggleModel',
  'togglePrivacy',
  'increaseFontSize',
  'decreaseFontSize',
  'scrollUp',
  'scrollDown',
])

const REPEATABLE = new Set<ShortcutId>(['scrollUp', 'scrollDown'])

export { SHORTCUT_TAKEN_MESSAGE }

let current: ShortcutMap | null = null
let suspended = false
let boundContentsId: number | null = null
let lastDispatchId: ShortcutId | null = null
let lastDispatchAt = 0
const failed = new Set<ShortcutId>()

export function registerShortcuts(shortcuts: ShortcutMap) {
  current = shortcuts
  bindGlobals()
  bindInputListener()
}

export function getFailedShortcutIds(): ShortcutId[] {
  return [...failed]
}

export function isAcceleratorTakenByOtherApp(accelerator: string): boolean {
  if (!accelerator) return false
  if (isAcceleratorRegistered(accelerator)) return false
  try {
    const ok = registerAccelerator(accelerator, () => undefined)
    if (ok) {
      unregisterAccelerator(accelerator)
      return false
    }
    return true
  } catch {
    return true
  }
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll()
}

export function suspendShortcuts(value: boolean) {
  suspended = value
  if (value) {
    globalShortcut.unregisterAll()
    return
  }
  bindGlobals()
}

function bindGlobals() {
  globalShortcut.unregisterAll()
  if (suspended || !current) return

  failed.clear()
  for (const id of Object.keys(current) as ShortcutId[]) {
    const accelerator = current[id]
    if (!accelerator) continue
    if (!registerAccelerator(accelerator, () => dispatch(id))) {
      failed.add(id)
    }
  }
  sendToRenderer(CHANNELS.shortcutsFailed, [...failed])
}

function acceleratorCandidates(accelerator: string): string[] {
  return accelerator.endsWith('+=')
    ? [accelerator, `${accelerator.slice(0, -1)}Plus`]
    : [accelerator]
}

function isAcceleratorRegistered(accelerator: string): boolean {
  return acceleratorCandidates(accelerator).some((candidate) => {
    try {
      return globalShortcut.isRegistered(candidate)
    } catch {
      return false
    }
  })
}

function registerAccelerator(accelerator: string, onTrigger: () => void): boolean {
  const candidates = acceleratorCandidates(accelerator)
  for (const candidate of candidates) {
    try {
      if (globalShortcut.register(candidate, onTrigger)) return true
    } catch {
      continue
    }
  }
  return false
}

function unregisterAccelerator(accelerator: string) {
  const candidates = acceleratorCandidates(accelerator)
  for (const candidate of candidates) {
    try {
      globalShortcut.unregister(candidate)
    } catch {
      continue
    }
  }
}

function bindInputListener() {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  const contentsId = win.webContents.id
  if (boundContentsId === contentsId) return
  boundContentsId = contentsId

  win.webContents.on('before-input-event', (event, input) => {
    if (suspended || !current) return
    if (input.type !== 'keyDown' || input.isComposing) return
    const id = matchShortcut(input)
    if (!id) return
    if (input.isAutoRepeat && !REPEATABLE.has(id)) return
    event.preventDefault()
    dispatch(id)
  })
}

function matchShortcut(input: Electron.Input): ShortcutId | null {
  if (!current) return null
  const event = {
    key: input.key,
    code: input.code,
    ctrlKey: input.control,
    metaKey: input.meta,
    altKey: input.alt,
    shiftKey: input.shift,
  }
  for (const id of Object.keys(current) as ShortcutId[]) {
    const accelerator = current[id]
    if (accelerator && eventMatchesAccelerator(event, accelerator)) return id
  }
  return null
}

function dispatch(id: ShortcutId) {
  const now = Date.now()
  const gap = REPEATABLE.has(id) ? 40 : 180
  if (id === lastDispatchId && now - lastDispatchAt < gap) return
  lastDispatchId = id
  lastDispatchAt = now

  if (id === 'toggleWindow') {
    toggleMainWindow()
    return
  }
  if (id === 'toggleCollapsed') {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    if (!win.isVisible()) {
      showMainWindow()
      return
    }
    toggleCollapsed()
    return
  }

  const command = SHORTCUT_COMMANDS[id]
  if (!command) return
  if (SHOW_FIRST.has(id) || id === 'openCommandPalette') showMainWindow()
  sendToRenderer(CHANNELS.appCommand, command)
}
