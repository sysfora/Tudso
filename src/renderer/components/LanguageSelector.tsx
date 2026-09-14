import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'

const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Russian',
  'Arabic',
  'Chinese (Simplified)',
  'Chinese (Traditional)',
  'Japanese',
  'Korean',
  'Hindi',
  'Turkish',
  'Polish',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Greek',
  'Romanian',
  'Czech',
  'Hungarian',
  'Thai',
  'Vietnamese',
  'Indonesian',
  'Malay',
  'Ukrainian',
  'Hebrew',
  'Persian',
] as const

export function LanguageSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return [...LANGUAGE_OPTIONS]
    return LANGUAGE_OPTIONS.filter((language) => language.toLowerCase().includes(needle))
  }, [query])

  const selected = value?.trim() || 'English'

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between bg-field px-3 text-left text-[13px] hover:bg-lift"
          aria-label="Select answer language"
        >
          <span className="truncate">{selected}</span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={6}
          align="start"
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-lg border border-border bg-surface p-2 shadow-lg"
        >
          <div className="mb-2 flex items-center gap-2 rounded-md bg-surface-2 px-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search language"
              className="h-8 border-0 bg-transparent px-0 hover:bg-transparent focus-visible:bg-transparent"
              aria-label="Search language"
            />
          </div>

          <div className="max-h-56 overflow-y-auto">
            {options.length ? (
              options.map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => {
                    onChange(language)
                    setQuery('')
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] transition-colors duration-150 hover:bg-lift',
                    selected === language && 'bg-lift font-medium',
                  )}
                >
                  <span>{language}</span>
                  {selected === language ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
              ))
            ) : (
              <div className="px-2 py-2 text-[12px] text-muted">No matching language</div>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
