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
    else el.form?.requestSubmit()
    return
  }
  if (event.key === 'Tab') {
    if (el instanceof HTMLTextAreaElement) insertText(el, '\t')
    return
  }
  if (event.text && event.text !== '\u0000') insertText(el, event.text)
  else if (!event.ctrl && !event.alt && !event.meta && event.key.length === 1) insertText(el, event.key)
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

function mouseInit(event: OverlayPointerEvent, extra?: MouseEventInit): MouseEventInit {
  return {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: event.x,
    clientY: event.y,
    screenX: event.screenX,
    screenY: event.screenY,
    button: event.button,
    buttons: event.type === 'up' ? 0 : 1 << event.button,
    ...extra,
  }
}

function offsetFromPoint(el: HTMLInputElement | HTMLTextAreaElement, x: number, y: number) {
  return estimateOffset(el, x, y)
}

let measureCtx: CanvasRenderingContext2D | null = null

function textContext(el: HTMLElement) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return null
  const style = getComputedStyle(el)
  measureCtx.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  return { ctx: measureCtx, style }
}

function indexOnLine(text: string, x: number, ctx: CanvasRenderingContext2D) {
  if (x <= 0 || !text) return 0
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(text.slice(0, mid)).width <= x) lo = mid
    else hi = mid - 1
  }
  if (lo >= text.length) return text.length
  const left = ctx.measureText(text.slice(0, lo)).width
  const right = ctx.measureText(text.slice(0, lo + 1)).width
  return x - left > right - x ? lo + 1 : lo
}

function estimateOffset(el: HTMLInputElement | HTMLTextAreaElement, clientX: number, clientY: number) {
  const measured = textContext(el)
  if (!measured) return el.selectionStart ?? 0
  const { ctx, style } = measured
  const rect = el.getBoundingClientRect()
  const x = clientX - rect.left - parseFloat(style.paddingLeft) - parseFloat(style.borderLeftWidth) + el.scrollLeft
  const y = clientY - rect.top - parseFloat(style.paddingTop) - parseFloat(style.borderTopWidth) + el.scrollTop
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.4 || 20
  if (el instanceof HTMLInputElement) return indexOnLine(el.value, x, ctx)
  const lines = el.value.split('\n')
  const line = Math.min(lines.length - 1, Math.max(0, Math.floor(y / lineHeight)))
  let index = 0
  for (let i = 0; i < line; i++) index += (lines[i]?.length ?? 0) + 1
  return index + indexOnLine(lines[line] ?? '', x, ctx)
}

function isWordChar(ch: string) {
  return /[A-Za-z0-9_\u00C0-\u024F]/.test(ch)
}

function wordRange(value: string, index: number) {
  const at = Math.min(Math.max(index, 0), value.length)
  if (!value) return [0, 0] as const
  let start = at
  let end = at
  if (at < value.length && isWordChar(value[at] ?? '')) {
    while (start > 0 && isWordChar(value[start - 1] ?? '')) start -= 1
    while (end < value.length && isWordChar(value[end] ?? '')) end += 1
    return [start, end] as const
  }
  if (at > 0 && isWordChar(value[at - 1] ?? '')) {
    start = at
    while (start > 0 && isWordChar(value[start - 1] ?? '')) start -= 1
    return [start, at] as const
  }
  while (start > 0 && /\s/.test(value[start - 1] ?? '')) start -= 1
  while (end < value.length && /\s/.test(value[end] ?? '')) end += 1
  if (start === end) {
    start = Math.max(0, at - 1)
    end = Math.min(value.length, at + 1)
  }
  return [start, end] as const
}

function lineRange(value: string, index: number) {
  const start = value.lastIndexOf('\n', Math.max(0, index - 1)) + 1
  const next = value.indexOf('\n', index)
  const end = next < 0 ? value.length : next + 1
  return [start, end] as const
}

function selectEditable(
  el: HTMLInputElement | HTMLTextAreaElement,
  index: number,
  count: number,
  anchor: number,
) {
  const value = el.value
  if (count >= 3) {
    const range = lineRange(value, index)
    const from = lineRange(value, anchor)
    el.setSelectionRange(Math.min(from[0], range[0]), Math.max(from[1], range[1]))
    return
  }
  if (count === 2) {
    const range = wordRange(value, index)
    const from = wordRange(value, anchor)
    el.setSelectionRange(Math.min(from[0], range[0]), Math.max(from[1], range[1]))
    return
  }
  el.setSelectionRange(Math.min(anchor, index), Math.max(anchor, index))
}

function selectableRoot(el: Element | null) {
  return el?.closest('.markdown, article, .select-text') ?? null
}

function applyDomSelection(x: number, y: number, count: number, anchor: Range | null) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.caretRangeFromPoint?.(x, y)
  if (!range) return
  if (count >= 3) {
    const block = range.startContainer.parentElement?.closest('p, li, pre, h1, h2, h3, h4, blockquote, div')
    if (block) {
      const next = document.createRange()
      next.selectNodeContents(block)
      sel.removeAllRanges()
      sel.addRange(next)
    }
    return
  }
  if (count === 2) {
    const word = range.cloneRange()
    try {
      ;(word as Range & { expand?: (unit: string) => void }).expand?.('word')
    } catch {
      undefined
    }
    sel.removeAllRanges()
    sel.addRange(word)
    return
  }
  if (anchor) {
    try {
      sel.setBaseAndExtent(anchor.startContainer, anchor.startOffset, range.startContainer, range.startOffset)
    } catch {
      sel.removeAllRanges()
      sel.addRange(range)
    }
    return
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

const DOUBLE_CLICK_MS = 500
const DOUBLE_CLICK_PX = 6

const OVERLAY_SLIDER_EVENT = 'overlay:slider'

let pointerDownTarget: Element | null = null
let clickCount = 0
let lastClickAt = 0
let lastClickX = 0
let lastClickY = 0
let dragAnchor = 0
let dragCount = 1
let domAnchor: Range | null = null
let selecting = false
let sliderDrag: HTMLElement | null = null

function snapSliderValue(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value))
  if (!step || step <= 0) return clamped
  const snapped = min + Math.round((clamped - min) / step) * step
  return Math.min(max, Math.max(min, Number(snapped.toFixed(8))))
}

function overlaySliderRoot(el: Element | null): HTMLElement | null {
  if (!el) return null
  if (el instanceof HTMLInputElement && el.type === 'range') return el
  return el.closest('[data-slider]')
}

function sliderDisabled(root: HTMLElement) {
  if (root instanceof HTMLInputElement) return root.disabled
  return root.hasAttribute('data-disabled') || root.getAttribute('aria-disabled') === 'true'
}

function applySliderPointer(root: HTMLElement, clientX: number, commit = false) {
  if (sliderDisabled(root)) return
  const rect = root.getBoundingClientRect()
  const ratio = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width
  const clamped = Math.min(1, Math.max(0, ratio))
  if (root instanceof HTMLInputElement && root.type === 'range') {
    const min = Number(root.min || 0)
    const max = Number(root.max || 100)
    const step = root.step === 'any' ? 0 : Number(root.step || 1)
    const value = snapSliderValue(min + clamped * (max - min), min, max, step)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(root, String(value))
    root.dispatchEvent(new Event('input', { bubbles: true }))
    root.dispatchEvent(new Event('change', { bubbles: true }))
    return
  }
  const thumb = root.querySelector('[role="slider"]')
  const min = Number(thumb?.getAttribute('aria-valuemin') ?? root.getAttribute('data-min') ?? 0)
  const max = Number(thumb?.getAttribute('aria-valuemax') ?? root.getAttribute('data-max') ?? 100)
  const step = Number(root.getAttribute('data-step') ?? 1)
  const value = snapSliderValue(min + clamped * (max - min), min, max, step)
  root.dispatchEvent(new CustomEvent(OVERLAY_SLIDER_EVENT, { detail: { value, commit } }))
}

function dispatchPointer(target: EventTarget, type: 'pointermove' | 'mousemove', event: OverlayPointerEvent) {
  const init = mouseInit(event)
  if (type === 'pointermove') {
    target.dispatchEvent(new PointerEvent('pointermove', { ...init, pointerId: 1, pointerType: 'mouse' }))
    return
  }
  target.dispatchEvent(new MouseEvent('mousemove', init))
}

function nextClickCount(x: number, y: number) {
  const now = Date.now()
  const chained =
    now - lastClickAt <= DOUBLE_CLICK_MS && Math.hypot(x - lastClickX, y - lastClickY) <= DOUBLE_CLICK_PX
  clickCount = chained ? (clickCount % 3) + 1 : 1
  lastClickAt = now
  lastClickX = x
  lastClickY = y
  return clickCount
}

export function applyOverlayPointer(event: OverlayPointerEvent) {
  const hit = document.elementFromPoint(event.x, event.y)
  if (event.type === 'move') {
    if (sliderDrag) {
      applySliderPointer(sliderDrag, event.x)
      dispatchPointer(sliderDrag, 'pointermove', event)
      dispatchPointer(sliderDrag, 'mousemove', event)
      return
    }
    const moveTarget = pointerDownTarget ?? hit ?? document.body
    dispatchPointer(moveTarget, 'pointermove', event)
    dispatchPointer(moveTarget, 'mousemove', event)
    if (!selecting) return
    if (pointerDownTarget instanceof Element && isEditable(pointerDownTarget)) {
      selectEditable(pointerDownTarget, offsetFromPoint(pointerDownTarget, event.x, event.y), dragCount, dragAnchor)
      return
    }
    applyDomSelection(event.x, event.y, dragCount, domAnchor)
    return
  }
  if (event.type === 'down') {
    const slider = overlaySliderRoot(hit)
    const interactive = hit?.closest(
      'button, a, input, textarea, select, [role="button"], [role="menuitem"], [role="switch"], [role="slider"], [data-slider]',
    )
    if (interactive || slider) {
      desktop.window.cancelOverlayDrag()
    } else if (hit?.closest('.drag-region')) {
      desktop.window.beginOverlayDrag()
      pointerDownTarget = null
      selecting = false
      sliderDrag = null
      return
    } else {
      desktop.window.cancelOverlayDrag()
    }
    const target = hit ?? document.body
    pointerDownTarget = target
    const count = event.button === 0 ? nextClickCount(event.x, event.y) : 1
    dragCount = count
    selecting = event.button === 0
    sliderDrag = slider && event.button === 0 && !sliderDisabled(slider) ? slider : null
    if (sliderDrag) {
      selecting = false
      applySliderPointer(sliderDrag, event.x)
    } else if (target instanceof Element && isEditable(target)) {
      lastEditable = target
      target.focus()
      const index = offsetFromPoint(target, event.x, event.y)
      dragAnchor = count === 1 ? index : index
      if (count === 1) target.setSelectionRange(index, index)
      else selectEditable(target, index, count, index)
      domAnchor = null
    } else if (selectableRoot(target instanceof Element ? target : null)) {
      const range = document.caretRangeFromPoint?.(event.x, event.y)
      domAnchor = range ? range.cloneRange() : null
      applyDomSelection(event.x, event.y, count, count === 1 ? null : domAnchor)
    } else if (target instanceof HTMLElement && target.tabIndex >= 0) {
      target.focus()
      selecting = false
    } else {
      selecting = false
    }
    const init = mouseInit(event, { detail: count })
    target.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 1, pointerType: 'mouse' }))
    target.dispatchEvent(new MouseEvent('mousedown', init))
    return
  }
  if (event.type === 'up') {
    if (sliderDrag) applySliderPointer(sliderDrag, event.x, true)
    const target = sliderDrag ?? pointerDownTarget ?? hit ?? document.body
    const init = mouseInit(event, { detail: dragCount })
    target.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerId: 1, pointerType: 'mouse' }))
    target.dispatchEvent(new MouseEvent('mouseup', init))
    if (event.button === 0 && !sliderDrag) {
      target.dispatchEvent(new MouseEvent('click', init))
      if (dragCount === 2) target.dispatchEvent(new MouseEvent('dblclick', init))
    }
    pointerDownTarget = null
    selecting = false
    sliderDrag = null
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
