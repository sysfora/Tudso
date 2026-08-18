import { BrowserWindow, screen } from 'electron'
import { createRequire } from 'node:module'

const WM_KEYDOWN = 0x0100
const WM_KEYUP = 0x0101
const WM_SYSKEYDOWN = 0x0104
const WM_SYSKEYUP = 0x0105
const WH_KEYBOARD_LL = 13
const GWL_EXSTYLE = -20
const WS_EX_NOACTIVATE = 0x08000000
const WS_EX_TOOLWINDOW = 0x00000080
const WS_EX_APPWINDOW = 0x00040000
const WS_EX_TOPMOST = 0x00000008
const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOACTIVATE = 0x0010
const SWP_FRAMECHANGED = 0x0020
const HWND_TOPMOST = -1
const LLKHF_INJECTED = 0x00000010
const VK_SHIFT = 0x10
const VK_CONTROL = 0x11
const VK_MENU = 0x12
const VK_LWIN = 0x5b
const VK_RWIN = 0x5c

type Koffi = {
  load: (name: string) => { func: (sig: string) => (...args: never[]) => unknown }
  proto: (sig: string) => unknown
  register: (fn: (...args: never[]) => unknown, proto: unknown) => unknown
  struct: (name: string, fields: Record<string, string>) => unknown
  decode: (ptr: unknown, type: unknown) => { vkCode: number; flags: number }
}

type NativeApi = {
  koffi: Koffi
  kbdStruct: unknown
  GetWindowLongPtrW: (hwnd: bigint, index: number) => bigint | number
  SetWindowLongPtrW: (hwnd: bigint, index: number, value: bigint | number) => bigint | number
  SetWindowPos: (hwnd: bigint, insertAfter: number, x: number, y: number, cx: number, cy: number, flags: number) => boolean
  GetWindowRect: (hwnd: bigint, rect: Buffer) => boolean
  GetCursorPos: (point: Buffer) => boolean
  GetAsyncKeyState: (vk: number) => number
  SetWindowsHookExW: (id: number, fn: unknown, mod: null, thread: number) => unknown
  UnhookWindowsHookEx: (hook: unknown) => boolean
  CallNextHookEx: (hook: null, code: number, wParam: number, lParam: unknown) => number
}

let native: NativeApi | null | undefined
let hookCallback: unknown = null
let hookHandle: unknown = null
let hookedWindow: BrowserWindow | null = null

function loadNative(): NativeApi | null {
  if (process.platform !== 'win32') return null
  if (native !== undefined) return native
  try {
    const require = createRequire(import.meta.url)
    const koffi = require('koffi') as Koffi
    const user32 = koffi.load('user32.dll')
    const kbdStruct = koffi.struct('KBDLLHOOKSTRUCT', {
      vkCode: 'uint32',
      scanCode: 'uint32',
      flags: 'uint32',
      time: 'uint32',
      dwExtraInfo: 'uintptr',
    })
    native = {
      koffi,
      kbdStruct,
      GetWindowLongPtrW: user32.func('uintptr_t __stdcall GetWindowLongPtrW(uintptr_t hWnd, int nIndex)') as NativeApi['GetWindowLongPtrW'],
      SetWindowLongPtrW: user32.func('uintptr_t __stdcall SetWindowLongPtrW(uintptr_t hWnd, int nIndex, uintptr_t dwNewLong)') as NativeApi['SetWindowLongPtrW'],
      SetWindowPos: user32.func('bool __stdcall SetWindowPos(uintptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)') as NativeApi['SetWindowPos'],
      GetWindowRect: user32.func('bool __stdcall GetWindowRect(uintptr_t hWnd, uint8_t *lpRect)') as NativeApi['GetWindowRect'],
      GetCursorPos: user32.func('bool __stdcall GetCursorPos(uint8_t *lpPoint)') as NativeApi['GetCursorPos'],
      GetAsyncKeyState: user32.func('short __stdcall GetAsyncKeyState(int vKey)') as NativeApi['GetAsyncKeyState'],
      SetWindowsHookExW: user32.func('void *__stdcall SetWindowsHookExW(int idHook, void *lpfn, void *hMod, uint32_t dwThreadId)') as NativeApi['SetWindowsHookExW'],
      UnhookWindowsHookEx: user32.func('bool __stdcall UnhookWindowsHookEx(void *hhk)') as NativeApi['UnhookWindowsHookEx'],
      CallNextHookEx: user32.func('intptr_t __stdcall CallNextHookEx(void *hhk, int nCode, uintptr_t wParam, void *lParam)') as NativeApi['CallNextHookEx'],
    }
    const proto = koffi.proto('intptr_t __stdcall HookProc(int nCode, uintptr_t wParam, void *lParam)')
    hookCallback = koffi.register(lowLevelKeyboardProc as never, proto)
    return native
  } catch {
    native = null
    return null
  }
}

function hwnd(win: BrowserWindow): bigint {
  const buf = win.getNativeWindowHandle()
  return buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0))
}

function cursorInWindow(win: BrowserWindow): boolean {
  const api = loadNative()
  if (!api) {
    const point = screen.getCursorScreenPoint()
    const bounds = win.getBounds()
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    )
  }
  const point = Buffer.alloc(8)
  if (!api.GetCursorPos(point)) return false
  const x = point.readInt32LE(0)
  const y = point.readInt32LE(4)
  const rect = Buffer.alloc(16)
  if (!api.GetWindowRect(hwnd(win), rect)) return false
  return x >= rect.readInt32LE(0) && x < rect.readInt32LE(8) && y >= rect.readInt32LE(4) && y < rect.readInt32LE(12)
}

function currentModifiers(): Array<'shift' | 'control' | 'alt' | 'meta'> {
  const api = native
  const mods: Array<'shift' | 'control' | 'alt' | 'meta'> = []
  if (!api) return mods
  if (api.GetAsyncKeyState(VK_SHIFT) & 0x8000) mods.push('shift')
  if (api.GetAsyncKeyState(VK_CONTROL) & 0x8000) mods.push('control')
  if (api.GetAsyncKeyState(VK_MENU) & 0x8000) mods.push('alt')
  if (api.GetAsyncKeyState(VK_LWIN) & 0x8000 || api.GetAsyncKeyState(VK_RWIN) & 0x8000) mods.push('meta')
  return mods
}

function keyCodeFromVk(vk: number): string | null {
  if (vk >= 0x30 && vk <= 0x39) return String.fromCharCode(vk)
  if (vk >= 0x41 && vk <= 0x5a) return String.fromCharCode(vk)
  const named: Record<number, string> = {
    0x08: 'Backspace',
    0x09: 'Tab',
    0x0d: 'Enter',
    0x1b: 'Escape',
    0x20: 'Space',
    0x21: 'PageUp',
    0x22: 'PageDown',
    0x23: 'End',
    0x24: 'Home',
    0x25: 'Left',
    0x26: 'Up',
    0x27: 'Right',
    0x28: 'Down',
    0x2e: 'Delete',
    0xba: ';',
    0xbb: '=',
    0xbc: ',',
    0xbd: '-',
    0xbe: '.',
    0xbf: '/',
    0xc0: '`',
    0xdb: '[',
    0xdd: ']',
    0xdc: '\\',
    0xde: "'",
  }
  if (named[vk]) return named[vk]
  if (vk >= 0x70 && vk <= 0x7b) return `F${vk - 0x6f}`
  return null
}

function injectKey(win: BrowserWindow, vk: number, down: boolean) {
  if (win.isDestroyed()) return
  const keyCode = keyCodeFromVk(vk)
  if (!keyCode) return
  const modifiers = currentModifiers()
  const contents = win.webContents
  if (down) {
    contents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
    if (keyCode.length === 1 && !modifiers.includes('control') && !modifiers.includes('alt') && !modifiers.includes('meta')) {
      contents.sendInputEvent({ type: 'char', keyCode, modifiers })
    }
    return
  }
  contents.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
}

function lowLevelKeyboardProc(nCode: number, wParam: number, lParam: unknown): number {
  const api = native
  const win = hookedWindow
  if (nCode < 0 || !api || !win || win.isDestroyed() || !win.isVisible()) {
    return api ? api.CallNextHookEx(null, nCode, wParam, lParam) : 0
  }
  const info = api.koffi.decode(lParam, api.kbdStruct)
  if (info.flags & LLKHF_INJECTED) return api.CallNextHookEx(null, nCode, wParam, lParam)
  if (!cursorInWindow(win)) return api.CallNextHookEx(null, nCode, wParam, lParam)
  const down = wParam === WM_KEYDOWN || wParam === WM_SYSKEYDOWN
  const up = wParam === WM_KEYUP || wParam === WM_SYSKEYUP
  if (down || up) injectKey(win, info.vkCode, down)
  return 1
}

export function applyOverlayWindowStyle(win: BrowserWindow) {
  win.setSkipTaskbar(true)
  win.setFocusable(false)
  win.webContents.setBackgroundThrottling(false)
  try {
    win.setAlwaysOnTop(true, 'screen-saver', 1)
  } catch {
    try {
      win.setAlwaysOnTop(true, 'screen-saver')
    } catch {
      win.setAlwaysOnTop(true)
    }
  }
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } catch {
    undefined
  }

  const api = loadNative()
  if (!api) return
  try {
    const handle = hwnd(win)
    const current = Number(api.GetWindowLongPtrW(handle, GWL_EXSTYLE))
    const next = (current | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW | WS_EX_TOPMOST) & ~WS_EX_APPWINDOW
    api.SetWindowLongPtrW(handle, GWL_EXSTYLE, next)
    api.SetWindowPos(handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED)
  } catch {
    undefined
  }
}

export function clearOverlayWindowStyle(win: BrowserWindow) {
  stopOverlayKeyboard()
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

export function startOverlayKeyboard(win: BrowserWindow) {
  if (process.platform !== 'win32') return
  const api = loadNative()
  if (!api || !hookCallback) return
  hookedWindow = win
  if (hookHandle) return
  try {
    hookHandle = api.SetWindowsHookExW(WH_KEYBOARD_LL, hookCallback, null, 0)
  } catch {
    hookHandle = null
  }
}

export function stopOverlayKeyboard() {
  const api = native
  if (api && hookHandle) {
    try {
      api.UnhookWindowsHookEx(hookHandle)
    } catch {
      undefined
    }
  }
  hookHandle = null
  hookedWindow = null
}

export function showWithoutActivating(win: BrowserWindow) {
  if (win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.showInactive()
}
