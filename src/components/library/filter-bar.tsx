'use client'

import { Check, Search, Zap } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { RecipeCategory } from '@/types'

const CATEGORY_ITEMS: Array<{ value: RecipeCategory; label: string; color: string }> = [
  { value: 'starter', label: 'Vorspeise', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  { value: 'main', label: 'Hauptgericht', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'dessert', label: 'Dessert', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  { value: 'side', label: 'Beilage', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { value: 'breakfast', label: 'Frühstück', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { value: 'snack', label: 'Snack', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
]

const TAG_COLORS = [
  'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'bg-green-500/15 text-green-300 border-green-500/30',
  'bg-pink-500/15 text-pink-300 border-pink-500/30',
  'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'bg-teal-500/15 text-teal-300 border-teal-500/30',
]

function getTagColor(index: number) {
  return TAG_COLORS[index % TAG_COLORS.length]
}

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  activeCategory: RecipeCategory | null
  onCategoryChange: (category: RecipeCategory | null) => void
  activeTags: string[]
  onTagToggle: (tag: string) => void
  maxTime: number | null
  maxTimeLimit: number
  onMaxTimeChange: (value: number | null) => void
  availableTags: string[]
}

export function FilterBar({
  search,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  activeTags,
  onTagToggle,
  maxTime,
  maxTimeLimit,
  onMaxTimeChange,
  availableTags,
}: FilterBarProps) {
  const isCategoryActive = (category: RecipeCategory | null) => activeCategory === category
  const quickFilterActive = maxTime === 30
  const sliderValue = Math.min(maxTime ?? maxTimeLimit, maxTimeLimit)

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Rezepte suchen..."
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => onCategoryChange(null)}
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
            isCategoryActive(null)
              ? 'bg-primary/20 text-primary border-primary/50'
              : 'bg-zinc-800/50 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {isCategoryActive(null) ? <Check className="h-3.5 w-3.5" /> : null}
            Alle
          </span>
        </button>

        {CATEGORY_ITEMS.map((item) => {
          const active = isCategoryActive(item.value)
          return (
            <button
              key={item.value}
              onClick={() => onCategoryChange(active ? null : item.value)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                active
                  ? `${item.color} ring-1 ring-inset ring-white/20`
                  : 'bg-zinc-800/50 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {active ? <Check className="h-3.5 w-3.5" /> : null}
                {item.label}
              </span>
            </button>
          )
        })}

        <button
          onClick={() => onMaxTimeChange(quickFilterActive ? null : 30)}
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
            quickFilterActive
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              : 'bg-zinc-800/50 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {quickFilterActive ? <Check className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
            Schnell (&lt;30min)
          </span>
        </button>

        {availableTags.map((tag, index) => {
          const active = activeTags.includes(tag)
          return (
            <button
              key={tag}
              onClick={() => onTagToggle(tag)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                active
                  ? `${getTagColor(index)} ring-1 ring-inset ring-white/20`
                  : 'bg-zinc-800/50 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {active ? <Check className="h-3.5 w-3.5" /> : null}
                {tag}
              </span>
            </button>
          )
        })}
      </div>

      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
          <span>Zeit bis</span>
          <div className="flex items-center gap-2">
            <span>{maxTime === null ? `Beliebig (bis ${maxTimeLimit} min)` : `${maxTime} min`}</span>
            {maxTime !== null ? (
              <button
                type="button"
                onClick={() => onMaxTimeChange(null)}
                className="rounded px-1.5 py-0.5 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-700/70"
              >
                Zurücksetzen
              </button>
            ) : null}
          </div>
        </div>
        <Slider
          min={0}
          max={maxTimeLimit}
          step={5}
          value={[sliderValue]}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : [value]
            const next = arr[0] ?? maxTimeLimit
            onMaxTimeChange(next >= maxTimeLimit ? null : next)
          }}
          className="py-2"
        />
      </div>
    </div>
  )
}
