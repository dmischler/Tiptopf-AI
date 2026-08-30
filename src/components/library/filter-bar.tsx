'use client'

import { useState } from 'react'
import { Check, Clock, Heart, Search, Zap } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  CATEGORIES,
  CATEGORY_CHIP_CLASS,
  CATEGORY_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
} from '@/lib/recipe-meta'
import { cn } from '@/lib/utils'
import type { Difficulty, RecipeCategory } from '@/types'

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

const chipClass =
  'shrink-0 inline-flex min-h-11 items-center rounded-full border px-3 py-2 text-sm font-medium transition-colors touch-manipulation'

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
  activeDifficulty: Difficulty | null
  onDifficultyChange: (difficulty: Difficulty | null) => void
  favoritesOnly: boolean
  onFavoritesOnlyToggle: () => void
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
  activeDifficulty,
  onDifficultyChange,
  favoritesOnly,
  onFavoritesOnlyToggle,
}: FilterBarProps) {
  const [timeOpen, setTimeOpen] = useState(false)
  const isCategoryActive = (category: RecipeCategory | null) => activeCategory === category
  const quickFilterActive = maxTime === 30
  const sliderValue = Math.min(maxTime ?? maxTimeLimit, maxTimeLimit)
  const timeActive = timeOpen || maxTime !== null

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor="recipe-search" className="sr-only">
          Rezepte suchen
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="recipe-search"
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Rezepte suchen..."
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          type="button"
          onClick={() => onCategoryChange(null)}
          aria-pressed={isCategoryActive(null)}
          className={cn(
            chipClass,
            isCategoryActive(null)
              ? 'border-primary/50 bg-primary/20 text-primary'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
          )}
        >
          <span className="flex items-center gap-1.5">
            {isCategoryActive(null) ? <Check className="h-3.5 w-3.5" /> : null}
            Alle
          </span>
        </button>

        {CATEGORIES.map((category) => {
          const active = isCategoryActive(category)
          return (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryChange(active ? null : category)}
              aria-pressed={active}
              className={cn(
                chipClass,
                active
                  ? `${CATEGORY_CHIP_CLASS[category]} ring-1 ring-inset ring-white/20`
                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
              )}
            >
              <span className="flex items-center gap-1.5">
                {active ? <Check className="h-3.5 w-3.5" /> : null}
                {CATEGORY_LABELS[category]}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => onMaxTimeChange(quickFilterActive ? null : 30)}
          aria-pressed={quickFilterActive}
          className={cn(
            chipClass,
            quickFilterActive
              ? 'border-blue-500/40 bg-blue-500/20 text-blue-300'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
          )}
        >
          <span className="flex items-center gap-1.5">
            {quickFilterActive ? <Check className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
            Schnell (&lt;30min)
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTimeOpen((open) => !open)}
          aria-pressed={timeActive}
          className={cn(
            chipClass,
            'md:hidden',
            timeActive
              ? 'border-primary/50 bg-primary/20 text-primary'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
          )}
        >
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Zeit
          </span>
        </button>

        {DIFFICULTIES.map((difficulty) => {
          const active = activeDifficulty === difficulty
          return (
            <button
              key={difficulty}
              type="button"
              onClick={() => onDifficultyChange(active ? null : difficulty)}
              aria-pressed={active}
              className={cn(
                chipClass,
                active
                  ? 'border-primary/50 bg-primary/20 text-primary'
                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
              )}
            >
              <span className="flex items-center gap-1.5">
                {active ? <Check className="h-3.5 w-3.5" /> : null}
                {DIFFICULTY_LABELS[difficulty]}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={onFavoritesOnlyToggle}
          aria-pressed={favoritesOnly}
          className={cn(
            chipClass,
            favoritesOnly
              ? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
          )}
        >
          <span className="flex items-center gap-1.5">
            {favoritesOnly ? <Check className="h-3.5 w-3.5" /> : <Heart className="h-3.5 w-3.5" />}
            Favoriten
          </span>
        </button>

        {availableTags.map((tag, index) => {
          const active = activeTags.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onTagToggle(tag)}
              aria-pressed={active}
              className={cn(
                chipClass,
                active
                  ? `${getTagColor(index)} ring-1 ring-inset ring-white/20`
                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
              )}
            >
              <span className="flex items-center gap-1.5">
                {active ? <Check className="h-3.5 w-3.5" /> : null}
                {tag}
              </span>
            </button>
          )
        })}
      </div>

      <div
        className={cn(
          'rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2',
          timeOpen || maxTime !== null ? 'block' : 'hidden',
          'md:block'
        )}
      >
        <div className="mb-2 flex items-center justify-between text-sm text-zinc-400">
          <span>Zeit bis</span>
          <div className="flex items-center gap-2">
            <span>{maxTime === null ? `Beliebig (bis ${maxTimeLimit} min)` : `${maxTime} min`}</span>
            {maxTime !== null ? (
              <button
                type="button"
                onClick={() => onMaxTimeChange(null)}
                className="min-h-11 rounded px-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700/70"
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
