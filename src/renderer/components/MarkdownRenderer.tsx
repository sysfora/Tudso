import { Children, isValidElement, type ReactNode } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock, nodeText } from '@/components/CodeBlock'
import { desktop } from '@/lib/desktop'

function fencedLanguage(className?: string) {
  return /language-([a-z0-9+#_-]+)/i.exec(className ?? '')?.[1]
}

function codeChild(children: ReactNode) {
  const child = Children.toArray(children).find((node) => isValidElement(node))
  if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) return null
  return child
}

function isProseFence(language?: string) {
  return language === 'plaintext' || language === 'text'
}

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        if (href) void desktop.app.openExternal(href)
      }}
    >
      {children}
    </a>
  ),
  pre: ({ children }) => {
    const child = codeChild(children)
    const className = child?.props.className
    const language = fencedLanguage(className)
    const code = nodeText(child?.props.children ?? children).replace(/\n$/, '')
    if (isProseFence(language) && !code.includes('\n')) {
      return <p>{code}</p>
    }
    if (isProseFence(language) && !/[{};=<>]|^\s*(def |class |func |fn |import |package )/m.test(code)) {
      return <p className="whitespace-pre-wrap">{code}</p>
    }
    return <CodeBlock language={language} code={code} />
  },
  code: ({ className, children }) => <code className={className}>{children}</code>,
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
