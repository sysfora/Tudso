import { BrowserWindow, Menu, app, type MenuItemConstructorOptions } from 'electron'
import { SHORTCUT_LABELS } from '../shared/defaults'
import { CHANNELS } from '../shared/channels'
import type { AppCommand, AppMenuPopup, ShortcutId, ShortcutMap, WindowMode } from '../shared/types'
import type { AppStore } from './store'
import { sendToRenderer } from './windows'
import { beginOverlayPassthrough, endOverlayPassthrough } from './overlay'
import { isMac } from './platform'

const POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const SIZES: { id: WindowMode; label: string; shortcut: ShortcutId; command: AppCommand }[] = [
  { id: 'compact', label: 'Compact', shortcut: 'windowCompact', command: 'window-compact' },
  { id: 'normal', label: 'Normal', shortcut: 'windowNormal', command: 'window-normal' },
  { id: 'expanded', label: 'Expanded', shortcut: 'windowExpanded', command: 'window-expanded' },
]

function accelerator(shortcuts: ShortcutMap, id: ShortcutId) {
  return shortcuts[id] || undefined
}

function run(command: AppCommand) {
  sendToRenderer(CHANNELS.appCommand, command)
}

export function installApplicationMenu() {
  if (!isMac) {
    Menu.setApplicationMenu(null)
    return
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
    ]),
  )
}

export function popupAppMenu(win: BrowserWindow, store: AppStore, opts: AppMenuPopup) {
  if (win.isDestroyed()) return
  const shortcuts = store.getShortcuts()
  const accel = (id: ShortcutId) => accelerator(shortcuts, id)

  const template: MenuItemConstructorOptions[] = []

  if (opts.email) {
    template.push({ label: opts.email, click: () => run('open-account') }, { type: 'separator' })
  }

  template.push(
    opts.sessionLive
      ? {
          label: 'End session',
          accelerator: accel('endSession'),
          click: () => run('end-session'),
        }
      : {
          label: opts.hasConversation ? 'Continue session' : 'Start session',
          click: () => run('continue-session'),
        },
    {
      label: 'New session',
      accelerator: accel('newConversation'),
      enabled: !opts.sessionLive,
      click: () => run('new-conversation'),
    },
    {
      label: 'Copy last answer',
      accelerator: accel('copyLastAnswer'),
      click: () => run('copy-last-answer'),
    },
    {
      label: 'Copy last code',
      accelerator: accel('copyLastCode'),
      click: () => run('copy-last-code'),
    },
    {
      label: 'Command palette',
      accelerator: accel('openCommandPalette'),
      click: () => run('open-command-palette'),
    },
    { type: 'separator' },
    {
      label: 'Window size',
      submenu: SIZES.map((size) => ({
        label: size.label,
        type: 'radio' as const,
        checked: opts.windowMode === size.id,
        accelerator: accel(size.shortcut),
        click: () => run(size.command),
      })),
    },
    {
      label: 'Move window',
      submenu: POSITIONS.map((preset) => {
        const id = `positionWindow${preset}` as const
        const command = `position-window-${preset}` as AppCommand
        return {
          label: SHORTCUT_LABELS[id],
          accelerator: accel(id),
          click: () => run(command),
        }
      }),
    },
    { type: 'separator' },
    { label: 'Keyboard', click: () => run('open-shortcuts') },
    { label: 'Subscription', click: () => run('open-subscription') },
    { type: 'separator' },
    {
      label: 'Hide',
      accelerator: accel('toggleWindow'),
      click: () => run('hide-window'),
    },
    { label: 'Quit', click: () => app.quit() },
  )

  beginOverlayPassthrough()
  try {
    Menu.buildFromTemplate(template).popup({
      window: win,
      x: opts.x,
      y: opts.y,
      callback: () => endOverlayPassthrough(),
    })
  } catch {
    endOverlayPassthrough()
  }
}
