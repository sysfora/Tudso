import type { OverlayKeyEvent, OverlayPointerEvent, ShortcutId } from '@shared/types'
import { eventMatchesAccelerator } from '@shared/accelerator'
import { commandForShortcut } from '@shared/shortcut-commands'
import { runAppCommand } from '@/lib/commands'
import { desktop } from '@/lib/desktop'
import { useAppStore } from '@/store/app-store'

let lastEditable: HTMLInputElement | HTMLTextAreaElement | null = null

if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target
      if (target instanceof Element && isEditable(target)) lastEditable = target
    },
    true,
  )
}

function isEditable(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly
  if (!(el instanceof HTMLInputElement) || el.disabled || el.readOnly) return false
  return /^(text|search|password|email|url|tel|number|)$/i.test(el.type)
}

function keyInit(event: OverlayKeyEvent): KeyboardEventInit {
  return {
    key: event.key,
    code: event.code,
    bubbles: true,
    cancelable: true,
    ctrlKey: event.ctrl,
    altKey: event.alt,
    shiftKey: event.shift,
    metaKey: event.meta,
  }
}

function setValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  caret: number,
  inputType: string,
  data: string | null,
) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
  el.setSelectionRange(caret, caret)
  el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType, data }))
}

function insertText(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  if (!text) return
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  let next = el.value.slice(0, start) + text + el.value.slice(end)
  if (el.maxLength >= 0 && next.length > el.maxLength) {
    next = next.slice(0, el.maxLength)
  }
  setValue(el, next, Math.min(start + text.length, next.length), 'insertText', text)
}

function deleteRange(el: HTMLInputElement | HTMLTextAreaElement, from: number, to: number, inputType: string) {
  const start = Math.max(0, Math.min(from, to))
  const end = Math.max(from, to)
  if (start === end) return
  setValue(el, el.value.slice(0, start) + el.value.slice(end), start, inputType, null)
}

function applyEdit(el: HTMLInputElement | HTMLTextAreaElement, event: OverlayKeyEvent) {
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  const value = el.value

  if (event.paste != null) {
    insertText(el, event.paste)
    return
  }

  if ((event.ctrl || event.meta) && !event.alt) {
    const shortcut = event.key.toLowerCase()
    if (shortcut === 'a') {
      el.setSelectionRange(0, value.length)
      return
    }
    if (shortcut === 'c' || shortcut === 'x') {
      const selected = value.slice(start, end)
      if (selected) void navigator.clipboard.writeText(selected)
      if (shortcut === 'x') deleteRange(el, start, end, 'deleteByCut')
      return
    }
    if (shortcut === 'v') return
  }

  if (event.key === 'Backspace') {
    if (start !== end) deleteRange(el, start, end, 'deleteContentBackward')
    else if (start > 0) deleteRange(el, start - 1, start, 'deleteContentBackward')
    return
  }
  if (event.key === 'Delete') {
    if (start !== end) deleteRange(el, start, end, 'deleteContentForward')
    else if (end < value.length) deleteRange(el, start, start + 1, 'deleteContentForward')
    return
  }
  if (event.key === 'ArrowLeft') {
    const caret = event.shift ? end : Math.min(start, end)
    const next = event.ctrl || event.meta ? 0 : Math.max(0, caret - 1)
    el.setSelectionRange(event.shift ? start : next, event.shift ? Math.max(start, next) : next)
    return
  }
  if (event.key === 'ArrowRight') {
    const caret = event.shift ? end : Math.max(start, end)
    const next = event.ctrl || event.meta ? value.length : Math.min(value.length, caret + 1)
    el.setSelectionRange(event.shift ? start : next, event.shift ? next : next)
    return
  }
  if (event.key === 'Home') {
    if (event.shift) el.setSelectionRange(0, end)
    else el.setSelectionRange(0, 0)
    return
  }
  if (event.key === 'End') {
    if (event.shift) el.setSelectionRange(start, value.length)
    else el.setSelectionRange(value.length, value.length)
    return
  }
  if (event.key === 'Enter') {
    if (el instanceof HTMLTextAreaElement) insertText(el, '\n')
    return
  }
  if (event.key === 'Tab') {
    if (el instanceof HTMLTextAreaElement) insertText(el, '\t')
    return
  }
  if (event.text && event.text !== '\u0000') insertText(el, event.text)
}

function runOverlayCommand(event: OverlayKeyEvent) {
  if (!event.down) return false
  const store = useAppStore.getState()
  if (store.recordingShortcut) return false
  const accel = {
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrl,
    metaKey: event.meta,
    altKey: event.alt,
    shiftKey: event.shift,
  }
  for (const id of Object.keys(store.shortcuts) as ShortcutId[]) {
    const accelerator = store.shortcuts[id]
    if (!accelerator || !eventMatchesAccelerator(accel, accelerator)) continue
    const command = commandForShortcut(id)
    if (!command) continue
    runAppCommand(command)
    return true
  }
  return false
}

export function applyOverlayKey(event: OverlayKeyEvent) {
  if (runOverlayCommand(event)) return
  const el =
    (document.activeElement instanceof Element && isEditable(document.activeElement)
      ? document.activeElement
      : lastEditable) ?? document.getElementById('composer-input')
  if (!el) return
  const type = event.down ? 'keydown' : 'keyup'
  const keyEvent = new KeyboardEvent(type, keyInit(event))
  const prevented = !el.dispatchEvent(keyEvent) || keyEvent.defaultPrevented
  if (!event.down || prevented || !isEditable(el)) return
  applyEdit(el, event)
}

function mouseInit(event: OverlayPointerEvent): MouseEventInit {
  return {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: event.x,
    clientY: event.y,
    screenX: event.screenX,
    screenY: event.screenY,
    button: event.button,
    buttons: event.type === 'down' ? 1 << event.button : 0,
  }
}

function setCaretFromPoint(el: HTMLInputElement | HTMLTextAreaElement, x: number, y: number) {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const position = doc.caretPositionFromPoint?.(x, y)
  if (position && el.contains(position.offsetNode)) {
    el.setSelectionRange(position.offset, position.offset)
    return
  }
  const range = doc.caretRangeFromPoint?.(x, y)
  if (range && el.contains(range.startContainer)) {
    el.setSelectionRange(range.startOffset, range.startOffset)
  }
}

let pointerDownTarget: Element | null = null

export function applyOverlayPointer(event: OverlayPointerEvent) {
  const hit = document.elementFromPoint(event.x, event.y)
  if (event.type === 'down') {
    const interactive = hit?.closest(
      'button, a, input, textarea, select, [role="button"], [role="menuitem"], [role="switch"]',
    )
    if (interactive) {
      desktop.window.cancelOverlayDrag()
    } else if (hit?.closest('.drag-region')) {
      desktop.window.beginOverlayDrag()
      pointerDownTarget = null
      return
    } else {
      desktop.window.cancelOverlayDrag()
    }
    const target = hit ?? document.body
    pointerDownTarget = target
    if (target instanceof Element && isEditable(target)) {
      lastEditable = target
      target.focus()
      setCaretFromPoint(target, event.x, event.y)
    } else if (target instanceof HTMLElement && target.tabIndex >= 0) {
      target.focus()
    }
    const init = mouseInit(event)
    target.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 1, pointerType: 'mouse' }))
    target.dispatchEvent(new MouseEvent('mousedown', init))
    return
  }
  if (event.type === 'up') {
    const target = pointerDownTarget ?? hit ?? document.body
    const init = mouseInit(event)
    target.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerId: 1, pointerType: 'mouse' }))
    target.dispatchEvent(new MouseEvent('mouseup', init))
    if (event.button === 0) target.dispatchEvent(new MouseEvent('click', init))
    pointerDownTarget = null
    return
  }
  if (event.type === 'wheel') {
    const target = hit ?? document.body
    const deltaY = event.deltaY ?? 0
    target.dispatchEvent(
      new WheelEvent('wheel', {
        ...mouseInit(event),
        deltaY,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      }),
    )
    let node: Element | null = target
    while (node && node !== document.body) {
      if (node.scrollHeight > node.clientHeight + 1) {
        node.scrollTop += deltaY
        break
      }
      node = node.parentElement
    }
  }
}
