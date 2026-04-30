'use client'

import { useEffect, useRef, useState } from 'react'
import { Dices, Image, Link, PenLine, Plus, X } from 'lucide-react'

type ExpandableFabProps = {
  onRandom: () => void
  onManual: () => void
  onUrl: () => void
  onImage: () => void
}

const ACTIONS = [
  { key: 'random' as const, label: 'Zufallsrezept', icon: Dices, color: 'bg-amber-500', mobileOnly: true },
  { key: 'manual' as const, label: 'Manuell', icon: PenLine, color: 'bg-sky-500', mobileOnly: false },
  { key: 'url' as const, label: 'URL', icon: Link, color: 'bg-emerald-500', mobileOnly: false },
  { key: 'image' as const, label: 'Bild', icon: Image, color: 'bg-violet-500', mobileOnly: false },
]

export function ExpandableFab({ onRandom, onManual, onUrl, onImage }: ExpandableFabProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handlers: Record<string, () => void> = {
    random: onRandom,
    manual: onManual,
    url: onUrl,
    image: onImage,
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && open) {
        setOpen(false)
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[55] bg-black/20 transition-opacity duration-200"
          onClick={() => setOpen(false)}
        />
      )}
      <div ref={containerRef} className="fixed right-6 z-[60] flex flex-col items-end gap-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6">
        {ACTIONS.map((action, index) => {
          const Icon = action.icon
          const isVisible = open
          const delay = (ACTIONS.length - 1 - index) * 30

          return (
            <div
              key={action.key}
              className={[
                'flex items-center gap-3 transition-all duration-200 ease-out',
                action.mobileOnly ? 'md:hidden' : '',
                isVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
              ].join(' ')}
              style={{ transitionDelay: open ? `${delay}ms` : '0ms' }}
            >
              <span className="rounded-lg bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md ring-1 ring-foreground/10">
                {action.label}
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  handlers[action.key]?.()
                }}
                className={[
                  'flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg shadow-black/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-95',
                  action.color,
                ].join(' ')}
                aria-label={action.label}
              >
                <Icon className="h-5 w-5" />
              </button>
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-95 active:shadow-xl"
          aria-label={open ? 'Schließen' : 'Menü öffnen'}
          aria-expanded={open}
        >
          <Plus
            className={[
              'h-6 w-6 transition-transform duration-200',
              open ? 'rotate-45' : 'rotate-0',
            ].join(' ')}
          />
        </button>
      </div>
    </>
  )
}
