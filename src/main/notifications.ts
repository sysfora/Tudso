import { Notification } from 'electron'
import { APP_NAME } from '../shared/defaults'
import { loadAppIcon } from './icon'
import { getMainWindow } from './windows'

export function notifyIfUnfocused(title: string, body: string) {
  const win = getMainWindow()
  if (win && !win.isDestroyed() && win.isVisible() && win.isFocused()) return
  showNotification(title, body)
}

export function showNotification(title: string, body: string) {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title: title || APP_NAME,
    body,
    icon: loadAppIcon(),
    silent: true,
  })
  notification.show()
}
