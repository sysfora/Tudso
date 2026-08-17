import { EventSource } from 'eventsource'

if (typeof globalThis.EventSource === 'undefined') {
  globalThis.EventSource = EventSource as unknown as typeof globalThis.EventSource
}
