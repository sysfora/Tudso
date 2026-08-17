import type { Response } from 'express'

export function beginPlainStream(res: Response) {
  res.status(200)
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.socket?.setNoDelay(true)
  res.flushHeaders()
}

export function writePlainStream(res: Response, chunk: string) {
  if (!chunk || res.writableEnded) return
  res.write(chunk)
  const flushable = res as Response & { flush?: () => void }
  flushable.flush?.()
}

export function endPlainStream(res: Response) {
  if (!res.writableEnded) res.end()
}
