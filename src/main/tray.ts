import { Menu, Tray } from 'electron'
import { APP_NAME } from '../shared/defaults'
import { CHANNELS } from '../shared/channels'
import type { Settings } from '../shared/types'
import { loadTrayIcon } from './icon'
import { sendToRenderer, showMainWindow, toggleMainWindow } from './windows'

let tray: Tray | null = null
let refreshMenu: (() => void) | null = null

export function destroyTray() {
  tray?.destroy()
  tray = null
  refreshMenu = null
}

export function createTray(
  getSettings: () => Settings,
  onHideFromCapture: (value: boolean) => void,
  onQuit: () => void,
) {
  if (tray) return { refresh: () => refreshMenu?.() }

  const icon = loadTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip(APP_NAME)
  tray.on('click', () => toggleMainWindow())

  refreshMenu = () => {
    const settings = getSettings()
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        { label: `Show ${APP_NAME}`, click: () => showMainWindow() },
        { type: 'separator' },
        {
          label: 'New session',
          click: () => {
            showMainWindow()
            sendToRenderer(CHANNELS.appCommand, 'new-conversation')
          },
        },
        {
          label: 'Settings',
          click: () => {
            showMainWindow()
            sendToRenderer(CHANNELS.appCommand, 'open-settings')
          },
        },
        {
          label: 'Account',
          click: () => {
            showMainWindow()
            sendToRenderer(CHANNELS.appCommand, 'open-account')
          },
        },
        {
          label: 'Subscription',
          click: () => {
            showMainWindow()
            sendToRenderer(CHANNELS.appCommand, 'open-subscription')
          },
        },
        {
          label: 'Hide from screen share',
          type: 'checkbox',
          checked: settings.hideFromCapture,
          click: (item) => onHideFromCapture(item.checked),
        },
        { type: 'separator' },
        { label: 'Quit', click: onQuit },
      ]),
    )
  }

  refreshMenu()
  return { refresh: () => refreshMenu?.() }
}
