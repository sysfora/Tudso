import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mergeResumeIntoProfile, memoriesFromResume, parseResumeText, profileFromResume, clipResumeText } from '../shared/resume-parse'
import type { LocalProfile, ResumeImportResult } from '../shared/types'

export async function extractResumeTextFromFile(file: {
  fileName: string
  mimeType: string
  data: ArrayBuffer | Buffer | Uint8Array
}): Promise<{ text: string; extractedChars: number }> {
  const bytes = toBuffer(file.data)
  let text = ''
  try {
    text = await extractResumeText(bytes, file.mimeType, file.fileName)
  } catch {
    text = ''
  }
  const clipped = clipResumeText(text)
  return { text: clipped, extractedChars: clipped.replace(/\s+/g, ' ').trim().length }
}

export async function importResumeFromBuffer(file: {
  fileName: string
  mimeType: string
  data: ArrayBuffer | Buffer | Uint8Array
}): Promise<ResumeImportResult> {
  const { text } = await extractResumeTextFromFile(file)
  const parsed = parseResumeText(text)
  const clipped = clipResumeText(text)
  return {
    parsed,
    profile: profileFromResume(parsed),
    memories: memoriesFromResume(parsed),
    text: clipped,
    extractedChars: clipped.replace(/\s+/g, ' ').trim().length,
  }
}

export function applyResumeImport(profile: LocalProfile, imported: ResumeImportResult): LocalProfile {
  return mergeResumeIntoProfile(profile, imported.parsed)
}

async function extractResumeText(bytes: Buffer, mimeType: string, fileName: string): Promise<string> {
  const mime = mimeType.toLowerCase()
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (mime === 'application/pdf' || ext === 'pdf') return extractPdf(bytes)
  if (mime.includes('wordprocessingml') || ext === 'docx') return extractDocx(bytes)
  if (mime.startsWith('text/') || mime === 'application/json' || ext === 'txt') {
    return bytes.toString('utf8')
  }
  if (ext === 'doc' || mime === 'application/msword') {
    const asText = bytes.toString('utf8')
    if (asText.replace(/\0/g, '').trim().length > 40 && !asText.includes('\u0000')) return asText
    return ''
  }
  return ''
}

async function extractPdf(bytes: Buffer): Promise<string> {
  const mod = await import('pdf-parse')
  const PDFParse = mod.PDFParse
  PDFParse.setWorker(pdfWorkerSrc())
  const parser = new PDFParse({ data: bytes })
  try {
    const result = await parser.getText()
    return result.text ?? ''
  } finally {
    await parser.destroy()
  }
}

async function extractDocx(bytes: Buffer): Promise<string> {
  const mod = await import('mammoth')
  const mammoth = mod.default ?? mod
  const result = await mammoth.extractRawText({ buffer: bytes })
  return result.value ?? ''
}

function pdfWorkerSrc() {
  const nextToMain = join(dirname(fileURLToPath(import.meta.url)), 'pdf.worker.mjs')
  if (existsSync(nextToMain)) return pathToFileURL(nextToMain).href
  const fromPkg = join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  if (existsSync(fromPkg)) return pathToFileURL(fromPkg).href
  return pathToFileURL(nextToMain).href
}

function toBuffer(data: ArrayBuffer | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  return Buffer.from(new Uint8Array(data))
}
