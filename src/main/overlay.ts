import { BrowserWindow, clipboard, screen } from 'electron'
import { createRequire } from 'node:module'
import { CHANNELS } from '../shared/channels'
import type { OverlayKeyEvent, OverlayPointerEvent } from '../shared/types'

const WM_KEYDOWN = 0x0100
const WM_KEYUP = 0x0101
const WM_SYSKEYDOWN = 0x0104
const WM_SYSKEYUP = 0x0105
const WH_KEYBOARD_LL = 13
const WH_MOUSE_LL = 14
const GWL_EXSTYLE = -20
const WS_EX_NOACTIVATE = 0x08000000
const WS_EX_TOOLWINDOW = 0x00000080
const WS_EX_TOPMOST = 0x00000008
const WS_EX_LAYERED = 0x00080000
const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOZORDER = 0x0004
const SWP_NOACTIVATE = 0x0010
const SWP_NOSENDCHANGING = 0x0400
const SWP_FRAMECHANGED = 0x0020
const HWND_TOPMOST = -1
const GA_ROOT = 2
const WM_MOUSEACTIVATE = 0x0021
const WM_NCACTIVATE = 0x0086
const WM_ACTIVATE = 0x0006
const MA_NOACTIVATE = 3
const LLKHF_INJECTED = 0x00000010
const LLMHF_INJECTED = 0x00000001
const WM_MOUSEMOVE = 0x0200
const WM_LBUTTONDOWN = 0x0201
const WM_LBUTTONUP = 0x0202
const WM_RBUTTONDOWN = 0x0204
const WM_RBUTTONUP = 0x0205
const WM_MOUSEWHEEL = 0x020A
const WM_MBUTTONDOWN = 0x0207
const WM_MBUTTONUP = 0x0208
const RESIZE_EDGE = 6
const TITLEBAR_HEIGHT = 56
const DRAG_THRESHOLD = 4
const VK_BACK = 0x08
const VK_TAB = 0x09
const VK_RETURN = 0x0d
const VK_SHIFT = 0x10
const VK_CONTROL = 0x11
const VK_MENU = 0x12
const VK_CAPITAL = 0x14
const VK_ESCAPE = 0x1b
const VK_SPACE = 0x20
const VK_PRIOR = 0x21
const VK_NEXT = 0x22
const VK_END = 0x23
const VK_HOME = 0x24
const VK_LEFT = 0x25
const VK_UP = 0x26
const VK_RIGHT = 0x27
const VK_DOWN = 0x28
const VK_DELETE = 0x2e
const VK_LWIN = 0x5b
const VK_RWIN = 0x5c

type Koffi = {
  load: (name: string) => { func: (sig: string) => (...args: never[]) => unknown }
  proto: (sig: string) => unknown
  pointer: (type: unknown) => unknown
  register: (fn: (...args: never[]) => unknown, proto: unknown) => unknown
  unregister: (cb: unknown) => void
  struct: (name: string, fields: Record<string, string>) => unknown
  decode: (ptr: unknown, type: unknown) => Record<string, number>
}

type NativeApi = {
  koffi: Koffi
  kbdStruct: unknown
  mouseStruct: unknown
  GetWindowLongW: (hwnd: bigint, index: number) => number
  SetWindowLongW: (hwnd: bigint, index: number, value: number) => number
  SetWindowPos: (hwnd: bigint, insertAfter: number, x: number, y: number, cx: number, cy: number, flags: number) => boolean
  GetWindowRect: (hwnd: bigint, rect: Buffer) => boolean
  GetCursorPos: (point: Buffer) => boolean
  GetAncestor: (hwnd: bigint, flags: number) => number | bigint
  GetAsyncKeyState: (vk: number) => number
  GetKeyboardState: (state: Buffer) => boolean
  ToUnicode: (vk: number, scan: number, state: Buffer, out: Buffer, chars: number, flags: number) => number
  SetWindowsHookExW: (id: number, fn: unknown, mod: null, thread: number) => unknown
  UnhookWindowsHookEx: (hook: unknown) => boolean
  CallNextHookEx: (hook: null, code: number, wParam: number, lParam: unknown) => number
  GetLastError: () => number
}

let native: NativeApi | null | undefined
let hookCallback: unknown = null
let mouseCallback: unknown = null
let hookHandle: unknown = null
let mouseHookHandle: unknown = null
let hookedWindow: BrowserWindow | null = null
let keyboardHookOk = false
let mouseActivateWindow: BrowserWindow | null = null
let overlayDrag: { dx: number; dy: number } | null = null
let pendingDrag: { dx: number; dy: number; x: number; y: number } | null = null
let titleBarPending = false
let dragMoved = false
let dragCancelled = false
let overlayDragCssKey: string | null = null

function loadNative(): NativeApi | null {
  if (process.platform !== 'win32') return null
  if (native !== undefined) return native
  try {
    const require = createRequire(import.meta.url)
    const koffi = require('koffi') as Koffi
    const user32 = koffi.load('user32.dll')
    const kernel32 = koffi.load('kernel32.dll')
    const kbdStruct = koffi.struct('KBDLLHOOKSTRUCT', {
      vkCode: 'uint32',
      scanCode: 'uint32',
      flags: 'uint32',
      time: 'uint32',
      dwExtraInfo: 'uintptr',
    })
    const hookProc = koffi.proto('intptr_t __stdcall HookProc(int nCode, uintptr_t wParam, void *lParam)')
    const mouseStruct = koffi.struct('MSLLHOOKSTRUCT', {
      x: 'int32',
      y: 'int32',
      mouseData: 'uint32',
      flags: 'uint32',
      time: 'uint32',
      dwExtraInfo: 'uintptr',
    })
    native = {
      koffi,
      kbdStruct,
      mouseStruct,
      GetWindowLongW: user32.func('int32_t __stdcall GetWindowLongW(uintptr_t hWnd, int nIndex)') as NativeApi['GetWindowLongW'],
      SetWindowLongW: user32.func('int32_t __stdcall SetWindowLongW(uintptr_t hWnd, int nIndex, int32_t dwNewLong)') as NativeApi['SetWindowLongW'],
      SetWindowPos: user32.func('bool __stdcall SetWindowPos(uintptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)') as NativeApi['SetWindowPos'],
      GetWindowRect: user32.func('bool __stdcall GetWindowRect(uintptr_t hWnd, void *lpRect)') as NativeApi['GetWindowRect'],
      GetCursorPos: user32.func('bool __stdcall GetCursorPos(void *lpPoint)') as NativeApi['GetCursorPos'],
      GetAncestor: user32.func('uintptr_t __stdcall GetAncestor(uintptr_t hWnd, uint32_t gaFlags)') as NativeApi['GetAncestor'],
      GetAsyncKeyState: user32.func('short __stdcall GetAsyncKeyState(int vKey)') as NativeApi['GetAsyncKeyState'],
      GetKeyboardState: user32.func('bool __stdcall GetKeyboardState(uint8_t *lpKeyState)') as NativeApi['GetKeyboardState'],
      ToUnicode: user32.func('int __stdcall ToUnicode(uint32_t wVirtKey, uint32_t wScanCode, const uint8_t *lpKeyState, uint16_t *pwszBuff, int cchBuff, uint32_t wFlags)') as NativeApi['ToUnicode'],
      SetWindowsHookExW: user32.func('void *__stdcall SetWindowsHookExW(int idHook, HookProc *lpfn, void *hMod, uint32_t dwThreadId)') as NativeApi['SetWindowsHookExW'],
      UnhookWindowsHookEx: user32.func('bool __stdcall UnhookWindowsHookEx(void *hhk)') as NativeApi['UnhookWindowsHookEx'],
      CallNextHookEx: user32.func('intptr_t __stdcall CallNextHookEx(void *hhk, int nCode, uintptr_t wParam, void *lParam)') as NativeApi['CallNextHookEx'],
      GetLastError: kernel32.func('uint32_t __stdcall GetLastError()') as NativeApi['GetLastError'],
    }
    const hookPtr = koffi.pointer(hookProc)
    try {
      hookCallback = koffi.register(lowLevelKeyboardProc as never, hookPtr)
    } catch (error) {
      console.error('[overlay] failed to register keyboard callback', error)
      hookCallback = null
    }
    try {
      mouseCallback = koffi.register(lowLevelMouseProc as never, hookPtr)
    } catch (error) {
      console.error('[overlay] failed to register mouse callback', error)
      mouseCallback = null
    }
    return native
  } catch (error) {
    console.error('[overlay] failed to load native window APIs', error)
    native = null
    return null
  }
}

function hwnd(win: BrowserWindow): bigint {
  const buf = win.getNativeWindowHandle()
  const raw = buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0))
  const api = native
  if (!api) return raw
  try {
    const root = BigInt(api.GetAncestor(raw, GA_ROOT))
    return root === 0n ? raw : root
  } catch {
    return raw
  }
}

function nativeRect(win: BrowserWindow) {
  const api = native
  if (!api) return null
  const buf = Buffer.alloc(16)
  if (!api.GetWindowRect(hwnd(win), buf)) return null
  const x = buf.readInt32LE(0)
  const y = buf.readInt32LE(4)
  const right = buf.readInt32LE(8)
  const bottom = buf.readInt32LE(12)
  const width = right - x
  const height = bottom - y
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

function physicalPlacement(
  win: BrowserWindow,
  x: number,
  y: number,
  width?: number,
  height?: number,
) {
  const bounds = win.getBounds()
  const rect = nativeRect(win)
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { x, y, width: width ?? bounds.width, height: height ?? bounds.height }
  }
  const scaleX = rect.width / Math.max(1, bounds.width)
  const scaleY = rect.height / Math.max(1, bounds.height)
  return {
    x: Math.round(rect.x + (x - bounds.x) * scaleX),
    y: Math.round(rect.y + (y - bounds.y) * scaleY),
    width: Math.round((width ?? bounds.width) * scaleX),
    height: Math.round((height ?? bounds.height) * scaleY),
  }
}

function nativeCursor() {
  const api = native
  if (!api) return null
  const buf = Buffer.alloc(8)
  if (!api.GetCursorPos(buf)) return null
  return { x: buf.readInt32LE(0), y: buf.readInt32LE(4) }
}

export function setWindowPositionNoActivate(win: BrowserWindow, x: number, y: number) {
  if (win.isDestroyed()) return
  const api = loadNative()
  if (!api) {
    win.setPosition(x, y, false)
    return
  }
  const next = physicalPlacement(win, x, y)
  api.SetWindowPos(hwnd(win), 0, next.x, next.y, 0, 0, MOVE_FLAGS)
}

const MOVE_FLAGS = SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOSENDCHANGING

function moveWindowPhysical(win: BrowserWindow, x: number, y: number) {
  const api = native
  if (!api || win.isDestroyed()) return
  api.SetWindowPos(hwnd(win), 0, x, y, 0, 0, MOVE_FLAGS)
}

export function setWindowBoundsNoActivate(
  win: BrowserWindow,
  bounds: { x: number; y: number; width: number; height: number },
) {
  if (win.isDestroyed()) return
  const api = loadNative()
  if (!api) {
    win.setBounds(bounds, false)
    return
  }
  const next = physicalPlacement(win, bounds.x, bounds.y, bounds.width, bounds.height)
  api.SetWindowPos(hwnd(win), 0, next.x, next.y, next.width, next.height, SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOSENDCHANGING)
}

function cursorInWindow(win: BrowserWindow, cursor?: { x: number; y: number } | null): boolean {
  const point = cursor ?? nativeCursor()
  const rect = nativeRect(win)
  if (point && rect) {
    return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height
  }
  const dip = screen.getCursorScreenPoint()
  const bounds = win.getBounds()
  return dip.x >= bounds.x && dip.x < bounds.x + bounds.width && dip.y >= bounds.y && dip.y < bounds.y + bounds.height
}

function keyDown(vk: number): boolean {
  return Boolean(native && native.GetAsyncKeyState(vk) & 0x8000)
}

function namedKey(vk: number): { key: string; code: string } | null {
  const named: Record<number, { key: string; code: string }> = {
    [VK_BACK]: { key: 'Backspace', code: 'Backspace' },
    [VK_TAB]: { key: 'Tab', code: 'Tab' },
    [VK_RETURN]: { key: 'Enter', code: 'Enter' },
    [VK_SHIFT]: { key: 'Shift', code: 'ShiftLeft' },
    [VK_CONTROL]: { key: 'Control', code: 'ControlLeft' },
    [VK_MENU]: { key: 'Alt', code: 'AltLeft' },
    [VK_CAPITAL]: { key: 'CapsLock', code: 'CapsLock' },
    [VK_ESCAPE]: { key: 'Escape', code: 'Escape' },
    [VK_SPACE]: { key: ' ', code: 'Space' },
    [VK_PRIOR]: { key: 'PageUp', code: 'PageUp' },
    [VK_NEXT]: { key: 'PageDown', code: 'PageDown' },
    [VK_END]: { key: 'End', code: 'End' },
    [VK_HOME]: { key: 'Home', code: 'Home' },
    [VK_LEFT]: { key: 'ArrowLeft', code: 'ArrowLeft' },
    [VK_UP]: { key: 'ArrowUp', code: 'ArrowUp' },
    [VK_RIGHT]: { key: 'ArrowRight', code: 'ArrowRight' },
    [VK_DOWN]: { key: 'ArrowDown', code: 'ArrowDown' },
    [VK_DELETE]: { key: 'Delete', code: 'Delete' },
    [VK_LWIN]: { key: 'Meta', code: 'MetaLeft' },
    [VK_RWIN]: { key: 'Meta', code: 'MetaRight' },
  }
  if (named[vk]) return named[vk]
  if (vk >= 0x41 && vk <= 0x5a) {
    const letter = String.fromCharCode(vk)
    return { key: letter.toLowerCase(), code: `Key${letter}` }
  }
  if (vk >= 0x30 && vk <= 0x39) return { key: String.fromCharCode(vk), code: `Digit${String.fromCharCode(vk)}` }
  if (vk >= 0x60 && vk <= 0x69) return { key: String(vk - 0x60), code: `Numpad${vk - 0x60}` }
  if (vk >= 0x70 && vk <= 0x7b) return { key: `F${vk - 0x6f}`, code: `F${vk - 0x6f}` }
  return null
}

function fallbackChar(vk: number, shift: boolean): string {
  if (vk === VK_SPACE) return ' '
  if (vk >= 0x41 && vk <= 0x5a) {
    const letter = String.fromCharCode(vk)
    const caps = Boolean(native && native.GetAsyncKeyState(VK_CAPITAL) & 1)
    return shift !== caps ? letter : letter.toLowerCase()
  }
  if (vk >= 0x30 && vk <= 0x39) {
    if (!shift) return String.fromCharCode(vk)
    return ')!@#$%^&*('[vk - 0x30] ?? ''
  }
  if (vk >= 0x60 && vk <= 0x69) return String(vk - 0x60)
  const shifted: Record<number, [string, string]> = {
    0xba: [';', ':'],
    0xbb: ['=', '+'],
    0xbc: [',', '<'],
    0xbd: ['-', '_'],
    0xbe: ['.', '>'],
    0xbf: ['/', '?'],
    0xc0: ['`', '~'],
    0xdb: ['[', '{'],
    0xdc: ['\\', '|'],
    0xdd: [']', '}'],
    0xde: ["'", '"'],
    0x6e: ['.', '.'],
    0x6a: ['*', '*'],
    0x6b: ['+', '+'],
    0x6d: ['-', '-'],
    0x6f: ['/', '/'],
  }
  const pair = shifted[vk]
  if (!pair) return ''
  return shift ? pair[1] : pair[0]
}

function unicodeChar(vk: number, scan: number): string {
  const api = native
  if (!api) return fallbackChar(vk, keyDown(VK_SHIFT))
  try {
    const state = Buffer.alloc(256)
    api.GetKeyboardState(state)
    state[vk] = state[vk] | 0x80
    const out = Buffer.alloc(16)
    const n = api.ToUnicode(vk, scan, state, out, 8, 0)
    if (n > 0) return out.toString('utf16le', 0, n * 2)
  } catch {
    undefined
  }
  return fallbackChar(vk, keyDown(VK_SHIFT))
}

function buildOverlayKey(vk: number, scan: number, down: boolean): OverlayKeyEvent | null {
  const named = namedKey(vk)
  if (!named && vk < 0x20) return null
  const ctrl = keyDown(VK_CONTROL)
  const alt = keyDown(VK_MENU)
  const shift = keyDown(VK_SHIFT)
  const meta = keyDown(VK_LWIN) || keyDown(VK_RWIN)
  const key = named?.key ?? fallbackChar(vk, shift) ?? ''
  const code = named?.code ?? ''
  const printable = down && !ctrl && !alt && !meta && vk !== VK_BACK && vk !== VK_TAB && vk !== VK_RETURN && vk !== VK_ESCAPE && vk !== VK_DELETE
  const text = printable ? unicodeChar(vk, scan) : ''
  if (!key && !text) return null
  const event: OverlayKeyEvent = {
    down,
    key: text && text.length === 1 ? text : key,
    code,
    text,
    ctrl,
    alt,
    shift,
    meta,
  }
  if (down && (ctrl || meta) && !alt && vk === 0x56) {
    try {
      event.paste = clipboard.readText()
    } catch {
      event.paste = ''
    }
  }
  return event
}

function injectKey(win: BrowserWindow, vk: number, scan: number, down: boolean) {
  if (win.isDestroyed()) return
  const event = buildOverlayKey(vk, scan, down)
  if (!event) return
  win.webContents.send(CHANNELS.overlayKey, event)
}

function lowLevelKeyboardProc(nCode: number, wParam: number, lParam: unknown): number {
  const api = native
  const win = hookedWindow
  try {
    if (nCode < 0 || !api || !win || win.isDestroyed() || !win.isVisible()) {
      return api ? api.CallNextHookEx(null, nCode, wParam, lParam) : 0
    }
    const info = api.koffi.decode(lParam, api.kbdStruct) as { vkCode: number; scanCode: number; flags: number }
    if (info.flags & LLKHF_INJECTED) return api.CallNextHookEx(null, nCode, wParam, lParam)
    if (!cursorInWindow(win)) return api.CallNextHookEx(null, nCode, wParam, lParam)
    const down = wParam === WM_KEYDOWN || wParam === WM_SYSKEYDOWN
    const up = wParam === WM_KEYUP || wParam === WM_SYSKEYUP
    if (down || up) injectKey(win, info.vkCode, info.scanCode, down)
    return 1
  } catch (error) {
    console.error('[overlay] keyboard hook error', error)
    return api ? api.CallNextHookEx(null, nCode, wParam, lParam) : 0
  }
}

function onResizeEdge(win: BrowserWindow, x: number, y: number): boolean {
  const bounds = win.getBounds()
  return x < RESIZE_EDGE || y < RESIZE_EDGE || x >= bounds.width - RESIZE_EDGE || y >= bounds.height - RESIZE_EDGE
}

function inTitleBar(win: BrowserWindow, point: { x: number; y: number }): boolean {
  const bounds = win.getBounds()
  const height = Math.min(TITLEBAR_HEIGHT, bounds.height)
  return (
    point.y >= RESIZE_EDGE &&
    point.y < height &&
    point.x >= RESIZE_EDGE &&
    point.x < bounds.width - RESIZE_EDGE
  )
}

function captureDragOffset(win: BrowserWindow, cursor: { x: number; y: number }) {
  const rect = nativeRect(win)
  if (rect) return { dx: cursor.x - rect.x, dy: cursor.y - rect.y, x: cursor.x, y: cursor.y }
  const point = screen.getCursorScreenPoint()
  const bounds = win.getBounds()
  return { dx: point.x - bounds.x, dy: point.y - bounds.y, x: cursor.x, y: cursor.y }
}

function clearDrag() {
  overlayDrag = null
  pendingDrag = null
  titleBarPending = false
  dragMoved = false
}

function localPoint(win: BrowserWindow) {
  const point = screen.getCursorScreenPoint()
  const bounds = win.getBounds()
  return {
    x: point.x - bounds.x,
    y: point.y - bounds.y,
    screenX: point.x,
    screenY: point.y,
  }
}

function injectPointer(win: BrowserWindow, event: OverlayPointerEvent) {
  if (win.isDestroyed()) return
  win.webContents.send(CHANNELS.overlayPointer, event)
}

function signedWheelDelta(mouseData: number) {
  const raw = (mouseData >>> 16) & 0xffff
  return raw > 32767 ? raw - 65536 : raw
}

function lowLevelMouseProc(nCode: number, wParam: number, lParam: unknown): number {
  const api = native
  const win = hookedWindow
  try {
    if (nCode < 0 || !api || !win || win.isDestroyed() || !win.isVisible()) {
      return api ? api.CallNextHookEx(null, nCode, wParam, lParam) : 0
    }
    const info = api.koffi.decode(lParam, api.mouseStruct) as {
      x: number
      y: number
      flags: number
      mouseData: number
    }
    if (info.flags & LLMHF_INJECTED) return api.CallNextHookEx(null, nCode, wParam, lParam)
    const cursor = { x: info.x, y: info.y }

    if (overlayDrag) {
      if (wParam === WM_MOUSEMOVE) {
        dragMoved = true
        moveWindowPhysical(win, cursor.x - overlayDrag.dx, cursor.y - overlayDrag.dy)
        return api.CallNextHookEx(null, nCode, wParam, lParam)
      }
      if (wParam === WM_LBUTTONUP) {
        const moved = dragMoved
        clearDrag()
        if (!moved) injectPointer(win, { type: 'up', button: 0, ...localPoint(win) })
        return 1
      }
    }

    if (!cursorInWindow(win, cursor)) return api.CallNextHookEx(null, nCode, wParam, lParam)
    const point = localPoint(win)
    if (onResizeEdge(win, point.x, point.y) && !overlayDrag) {
      return api.CallNextHookEx(null, nCode, wParam, lParam)
    }

    if (wParam === WM_MOUSEMOVE) {
      if (titleBarPending && pendingDrag && !dragCancelled) {
        const dist = Math.hypot(cursor.x - pendingDrag.x, cursor.y - pendingDrag.y)
        if (dist >= DRAG_THRESHOLD) {
          overlayDrag = pendingDrag
          pendingDrag = null
          titleBarPending = false
          dragMoved = true
          moveWindowPhysical(win, cursor.x - overlayDrag.dx, cursor.y - overlayDrag.dy)
          return api.CallNextHookEx(null, nCode, wParam, lParam)
        }
      }
      return api.CallNextHookEx(null, nCode, wParam, lParam)
    }
    if (wParam === WM_LBUTTONDOWN) {
      dragCancelled = false
      dragMoved = false
      pendingDrag = captureDragOffset(win, cursor)
      titleBarPending = inTitleBar(win, point)
      injectPointer(win, { type: 'down', button: 0, ...point })
      return 1
    }
    if (wParam === WM_LBUTTONUP) {
      const moved = dragMoved
      clearDrag()
      if (!moved) injectPointer(win, { type: 'up', button: 0, ...point })
      return 1
    }
    if (wParam === WM_RBUTTONDOWN) {
      injectPointer(win, { type: 'down', button: 2, ...point })
      return 1
    }
    if (wParam === WM_RBUTTONUP) {
      injectPointer(win, { type: 'up', button: 2, ...point })
      return 1
    }
    if (wParam === WM_MBUTTONDOWN) {
      injectPointer(win, { type: 'down', button: 1, ...point })
      return 1
    }
    if (wParam === WM_MBUTTONUP) {
      injectPointer(win, { type: 'up', button: 1, ...point })
      return 1
    }
    if (wParam === WM_MOUSEWHEEL) {
      injectPointer(win, { type: 'wheel', button: 0, ...point, deltaY: -signedWheelDelta(info.mouseData) })
      return 1
    }
    return api.CallNextHookEx(null, nCode, wParam, lParam)
  } catch (error) {
    console.error('[overlay] mouse hook error', error)
    return api ? api.CallNextHookEx(null, nCode, wParam, lParam) : 0
  }
}

export function beginOverlayDrag() {
  if (dragCancelled) return
  const win = hookedWindow
  if (!win || win.isDestroyed()) return
  if (overlayDrag) return
  const cursor = nativeCursor()
  overlayDrag = pendingDrag ?? (cursor ? captureDragOffset(win, cursor) : null)
  pendingDrag = null
  titleBarPending = false
}

export function cancelOverlayDrag() {
  if (dragMoved || overlayDrag) return
  dragCancelled = true
  overlayDrag = null
  pendingDrag = null
  titleBarPending = false
}

export function isOverlayKeyboardActive() {
  return keyboardHookOk
}

export function ensureNoActivate(win: BrowserWindow) {
  if (process.platform !== 'win32' || win.isDestroyed()) return
  const api = loadNative()
  if (!api) return
  try {
    const handle = hwnd(win)
    const current = api.GetWindowLongW(handle, GWL_EXSTYLE) >>> 0
    const next = current | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_LAYERED
    api.SetWindowLongW(handle, GWL_EXSTYLE, next | 0)
    api.SetWindowPos(handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED)
  } catch (error) {
    console.error('[overlay] failed to apply WS_EX_NOACTIVATE', error)
  }
}

function preventActivationOnClick(win: BrowserWindow) {
  if (process.platform !== 'win32' || win.isDestroyed()) return
  if (mouseActivateWindow === win) return
  clearMouseActivateHook()
  mouseActivateWindow = win
  try {
    win.hookWindowMessage(WM_MOUSEACTIVATE, () => [true, MA_NOACTIVATE])
    win.hookWindowMessage(WM_ACTIVATE, () => [true, 0])
    win.hookWindowMessage(WM_NCACTIVATE, (wParam) => {
      if (wParam) return [true, 0]
    })
  } catch (error) {
    console.error('[overlay] activation hooks failed', error)
  }
}

function clearMouseActivateHook() {
  const current = mouseActivateWindow
  mouseActivateWindow = null
  if (!current || current.isDestroyed()) return
  for (const message of [WM_MOUSEACTIVATE, WM_ACTIVATE, WM_NCACTIVATE]) {
    try {
      current.unhookWindowMessage(message)
    } catch {
      undefined
    }
  }
}

export function applyOverlayWindowStyle(win: BrowserWindow) {
  win.setSkipTaskbar(true)
  win.setFocusable(false)
  win.webContents.setBackgroundThrottling(false)
  preventActivationOnClick(win)
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } catch {
    undefined
  }
  ensureNoActivate(win)
  if (!overlayDragCssKey) {
    void win.webContents
      .insertCSS('.drag-region{-webkit-app-region:no-drag !important;app-region:no-drag !important}')
      .then((key) => {
        overlayDragCssKey = key
      })
      .catch(() => undefined)
  }
}

export function clearOverlayWindowStyle(win: BrowserWindow) {
  stopOverlayKeyboard()
  clearMouseActivateHook()
  if (overlayDragCssKey) {
    const key = overlayDragCssKey
    overlayDragCssKey = null
    void win.webContents.removeInsertedCSS(key).catch(() => undefined)
  }
  win.setFocusable(true)
  try {
    win.setAlwaysOnTop(false)
  } catch {
    undefined
  }
  try {
    win.setVisibleOnAllWorkspaces(false)
  } catch {
    undefined
  }
}

export function startOverlayKeyboard(win: BrowserWindow): boolean {
  if (process.platform !== 'win32') {
    keyboardHookOk = false
    return false
  }
  const api = loadNative()
  hookedWindow = win
  if (!api) {
    keyboardHookOk = false
    return false
  }
  if (hookCallback && !hookHandle) {
    try {
      hookHandle = api.SetWindowsHookExW(WH_KEYBOARD_LL, hookCallback, null, 0)
    } catch (error) {
      console.error('[overlay] keyboard SetWindowsHookExW threw', error)
      hookHandle = null
    }
    if (!hookHandle) console.error('[overlay] keyboard hook was not installed', api.GetLastError())
  }
  if (mouseCallback && !mouseHookHandle) {
    try {
      mouseHookHandle = api.SetWindowsHookExW(WH_MOUSE_LL, mouseCallback, null, 0)
    } catch (error) {
      console.error('[overlay] mouse SetWindowsHookExW threw', error)
      mouseHookHandle = null
    }
    if (!mouseHookHandle) console.error('[overlay] mouse hook was not installed', api.GetLastError())
  }
  keyboardHookOk = Boolean(hookHandle)
  return keyboardHookOk
}

export function stopOverlayKeyboard() {
  const api = native
  overlayDrag = null
  pendingDrag = null
  titleBarPending = false
  dragMoved = false
  if (api && hookHandle) {
    try {
      api.UnhookWindowsHookEx(hookHandle)
    } catch {
      undefined
    }
  }
  if (api && mouseHookHandle) {
    try {
      api.UnhookWindowsHookEx(mouseHookHandle)
    } catch {
      undefined
    }
  }
  hookHandle = null
  mouseHookHandle = null
  hookedWindow = null
  keyboardHookOk = false
}

export function showWithoutActivating(win: BrowserWindow) {
  if (win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.showInactive()
}
