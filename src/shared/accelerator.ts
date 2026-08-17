const MODIFIERS = new Set(['Control', 'Meta', 'Alt', 'Shift', 'OS', 'AltGraph'])

const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  Spacebar: 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  ',': ',',
  '.': '.',
  '/': '/',
  '[': '[',
  ']': ']',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
}

const CODE_ALIASES: Record<string, string> = {
  Space: 'Space',
  Comma: ',',
  Period: '.',
  Slash: '/',
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Semicolon: ';',
  Quote: "'",
  Backslash: '\\',
  Backquote: '`',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Backspace: 'Backspace',
  Tab: 'Tab',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  NumpadDecimal: '.',
  NumpadDivide: '/',
  NumpadSubtract: '-',
  NumpadAdd: 'Plus',
  NumpadMultiply: '*',
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'F6',
  F7: 'F7',
  F8: 'F8',
  F9: 'F9',
  F10: 'F10',
  F11: 'F11',
  F12: 'F12',
}

const MODIFIER_PARTS = new Set([
  'CommandOrControl',
  'CmdOrCtrl',
  'Control',
  'Ctrl',
  'Command',
  'Cmd',
  'Meta',
  'Alt',
  'Option',
  'Shift',
])

export interface AcceleratorEvent {
  key: string
  code?: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

function physicalKey(event: AcceleratorEvent): string {
  const code = event.code ?? ''
  if (code) {
    const aliased = CODE_ALIASES[code]
    if (aliased) return aliased
    if (code.startsWith('Key') && code.length === 4) return code.slice(3)
    if (code.startsWith('Digit') && code.length === 6) return code.slice(5)
    if (/^Numpad\d$/.test(code)) return code.slice(6)
  }

  return KEY_ALIASES[event.key] ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key)
}

export function eventToAccelerator(event: AcceleratorEvent): string | null {
  const code = event.code ?? ''
  if (
    MODIFIERS.has(event.key) ||
    code.startsWith('Control') ||
    code.startsWith('Alt') ||
    code.startsWith('Shift') ||
    code.startsWith('Meta')
  ) {
    return null
  }

  const parts: string[] = []
  if (event.ctrlKey) parts.push('Control')
  if (event.metaKey) parts.push('Command')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')

  const key = physicalKey(event)
  if (!key) return null
  parts.push(key)
  return parts.join('+')
}

export function formatAccelerator(accelerator: string, platform = 'win32'): string {
  const isMac = platform === 'darwin'
  return accelerator
    .split('+')
    .map((part) => {
      if (part === 'CommandOrControl' || part === 'CmdOrCtrl') return isMac ? '⌘' : 'Ctrl'
      if (part === 'Command' || part === 'Cmd' || part === 'Meta') return isMac ? '⌘' : 'Win'
      if (part === 'Control' || part === 'Ctrl') return isMac ? '⌃' : 'Ctrl'
      if (part === 'Shift') return isMac ? '⇧' : 'Shift'
      if (part === 'Alt' || part === 'Option') return isMac ? '⌥' : 'Alt'
      if (part === 'Space') return 'Space'
      if (part === 'Esc') return 'Esc'
      return part
    })
    .join(isMac ? '' : ' + ')
}

export function eventMatchesAccelerator(event: AcceleratorEvent, accelerator: string): boolean {
  const parts = accelerator.split('+')
  const wantsCommandOrControl = parts.includes('CommandOrControl') || parts.includes('CmdOrCtrl')
  const wantsCtrl = parts.includes('Control') || parts.includes('Ctrl') || wantsCommandOrControl
  const wantsMeta = parts.includes('Command') || parts.includes('Cmd') || parts.includes('Meta') || wantsCommandOrControl
  const wantsShift = parts.includes('Shift')
  const wantsAlt = parts.includes('Alt') || parts.includes('Option')
  const key = parts[parts.length - 1]

  if (wantsCommandOrControl) {
    if (!(event.ctrlKey || event.metaKey)) return false
  } else {
    if (wantsCtrl !== event.ctrlKey) return false
    if (wantsMeta !== event.metaKey) return false
  }
  if (wantsShift !== event.shiftKey) return false
  if (wantsAlt !== event.altKey) return false

  return keysEquivalent(physicalKey(event), key)
}

function keysEquivalent(actual: string, expected: string): boolean {
  const a = actual.toLowerCase()
  const b = expected.toLowerCase()
  if (a === b) return true
  const plus = new Set(['plus', '=', 'add'])
  if (plus.has(a) && plus.has(b)) return true
  const minus = new Set(['minus', '-', 'subtract'])
  return minus.has(a) && minus.has(b)
}

export function modifierCount(accelerator: string): number {
  return accelerator.split('+').filter((part) => MODIFIER_PARTS.has(part)).length
}
