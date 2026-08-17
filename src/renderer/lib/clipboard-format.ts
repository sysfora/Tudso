export function markdownToPlain(markdown: string) {
  return markdown
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function lastCodeBlock(markdown: string) {
  const blocks = codeBlocks(markdown)
  if (blocks.length) return blocks[blocks.length - 1]
  const inline = markdown.match(/`([^`]+)`/)
  return inline?.[1] ?? null
}

export function codeBlocks(markdown: string) {
  return [...markdown.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1].replace(/\n$/, ''))
}

export function codeFromAnswer(markdown: string) {
  const blocks = codeBlocks(markdown)
  if (blocks.length) return blocks.join('\n\n')
  return lastCodeBlock(markdown)
}
