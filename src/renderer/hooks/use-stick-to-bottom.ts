import { useEffect, useRef } from 'react'

export function useStickToBottom(dependency: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const onScroll = () => {
      stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80
    }
    node.addEventListener('scroll', onScroll)
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node || !stick.current) return
    node.scrollTop = node.scrollHeight
  }, [dependency])

  return ref
}
