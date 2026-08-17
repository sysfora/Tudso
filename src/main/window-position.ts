import { screen } from 'electron'
import { getMainWindow } from './windows'

const NUDGE = 80

export function moveToPreset(position: number) {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  if (position < 1 || position > 9) return

  const bounds = win.getBounds()
  const work = screen.getDisplayMatching(bounds).workArea
  const width = Math.min(bounds.width, work.width)
  const height = Math.min(bounds.height, work.height)
  const col = (position - 1) % 3
  const row = Math.floor((position - 1) / 3)
  const x = work.x + Math.round((col * (work.width - width)) / 2)
  const y = work.y + Math.round((row * (work.height - height)) / 2)
  const wasVisible = win.isVisible()
  win.setBounds({ x, y, width, height }, wasVisible)
  if (!wasVisible && win.isVisible()) win.hide()
}

export function moveBy(deltaX: number, deltaY: number) {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  const bounds = win.getBounds()
  const work = screen.getDisplayMatching(bounds).workArea
  const maxX = work.x + Math.max(0, work.width - bounds.width)
  const maxY = work.y + Math.max(0, work.height - bounds.height)
  const x = Math.min(Math.max(bounds.x + deltaX, work.x), maxX)
  const y = Math.min(Math.max(bounds.y + deltaY, work.y), maxY)
  const wasVisible = win.isVisible()
  win.setPosition(x, y, wasVisible)
  if (!wasVisible && win.isVisible()) win.hide()
}

export function nudgeWindow(direction: 'left' | 'right' | 'up' | 'down') {
  const delta = {
    left: { x: -NUDGE, y: 0 },
    right: { x: NUDGE, y: 0 },
    up: { x: 0, y: -NUDGE },
    down: { x: 0, y: NUDGE },
  }[direction]
  moveBy(delta.x, delta.y)
}

export function centerWindow() {
  moveToPreset(5)
}
