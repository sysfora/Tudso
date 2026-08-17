import { Check, Copy } from 'lucide-react'
import { Children, isValidElement, useMemo, useState, type ReactNode } from 'react'
import hljs from 'highlight.js'
import { IconButton } from '@/components/ui/icon-button'

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  cs: 'csharp',
  'c++': 'cpp',
  'c#': 'csharp',
  objc: 'objectivec',
  'objective-c': 'objectivec',
  kt: 'kotlin',
  rs: 'rust',
  golang: 'go',
  html: 'xml',
  plaintext: 'plaintext',
  text: 'plaintext',
}

export function nodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child)
      if (isValidElement<{ children?: ReactNode }>(child)) return nodeText(child.props.children)
      return ''
    })
    .join('')
}

function resolveLanguage(language?: string) {
  if (!language) return undefined
  const key = language.trim().toLowerCase()
  const mapped = LANGUAGE_ALIASES[key] ?? key
  return hljs.getLanguage(mapped) ? mapped : undefined
}

function highlightCode(code: string, language?: string) {
  if (!code) return ''
  const resolved = resolveLanguage(language)
  try {
    if (resolved && resolved !== 'plaintext') {
      return hljs.highlight(code, { language: resolved, ignoreIllegals: true }).value
    }
    const auto = hljs.highlightAuto(code)
    return auto.value
  } catch {
    return ''
  }
}

export function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const highlighted = useMemo(() => highlightCode(code, language), [code, language])
  const detected = useMemo(() => {
    const resolved = resolveLanguage(language)
    if (resolved) return resolved
    if (!code.trim()) return 'code'
    try {
      return hljs.highlightAuto(code).language || 'code'
    } catch {
      return 'code'
    }
  }, [code, language])

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg bg-surface-2">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] tracking-wide text-muted uppercase">{detected}</span>
        <IconButton label={copied ? 'Copied' : 'Copy code'} onClick={() => void copy()}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </IconButton>
      </div>
      <pre className="overflow-x-auto px-3 py-3 font-mono text-[13px] leading-[1.55]">
        {highlighted ? (
          <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  )
}
