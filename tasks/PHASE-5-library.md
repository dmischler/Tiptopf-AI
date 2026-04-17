# Phase 5: Recipe Library (Masonry Grid)

**Duration:** ~3 hours  
**Goal:** Pinterest-style masonry grid with search, filter, sort, and detail view

## Steps

### 5.1 Masonry Grid Component (Pure CSS)
Create `src/components/library/masonry-grid.tsx`:
```typescript
'use client'

// Pure CSS columns-based masonry layout.
// Items flow top-to-bottom within each column (not left-to-right like JS masonry).
// This is simpler, has no JS dependency, and is performant.

interface MasonryGridProps {
  children: React.ReactNode
  columns?: number
}

export function MasonryGrid({ children, columns = 4 }: MasonryGridProps) {
  // Responsive: 1 col mobile, 2 sm, 3 md, 4 lg+
  return (
    <div
      className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4"
    >
      {children}
    </div>
  )
}

export function MasonryItem({ children }: { children: React.ReactNode }) {
  // break-inside-avoid prevents card from splitting across columns
  return (
    <div className="break-inside-avoid">
      {children}
    </div>
  )
}
```

> **Implementation note:** Pure CSS `columns` is used instead of a JS masonry library. This means items fill column-by-column top-to-bottom rather than left-to-right like Pinterest. For a true Pinterest left-to-right ordering, a JS library would be needed, but CSS columns is simpler and performant for MVP.

### 5.2 Recipe Card Component
Create `src/components/library/recipe-card.tsx`:
```typescript
import Image from 'next/image'
import { Heart, Clock, ChefHat, Star, UtensilsCrossed } from 'lucide-react'
import type { Recipe } from '@/types'

interface RecipeCardProps {
  recipe: Recipe
  onClick: () => void
  onFavorite: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  starter: 'bg-blue-500/20 text-blue-400',
  main: 'bg-amber-500/20 text-amber-400',
  dessert: 'bg-pink-500/20 text-pink-400',
  side: 'bg-green-500/20 text-green-400',
  breakfast: 'bg-yellow-500/20 text-yellow-400',
  snack: 'bg-purple-500/20 text-purple-400',
}

export function RecipeCard({ recipe, onClick, onFavorite }: RecipeCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all hover:scale-[1.02]"
    >
      {recipe.image_url && (
        <div className="relative w-full aspect-[4/3]">
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground line-clamp-2">{recipe.title}</h3>
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite() }}
            className="shrink-0 p-1 rounded-full hover:bg-cardHover transition-colors"
            aria-label={recipe.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className={`w-5 h-5 ${recipe.is_favorite ? 'fill-rose-500 text-rose-500' : 'text-muted'}`}
            />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[recipe.category] || 'bg-zinc-700 text-zinc-300'}`}>
            {recipe.category}
          </span>
          <span className="px-2 py-0.5 bg-cardHover text-muted rounded text-xs">
            {recipe.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-3 text-muted text-sm">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {recipe.prep_time + recipe.cook_time > 0
              ? `${recipe.prep_time + recipe.cook_time}min`
              : '—'}
          </span>
          {recipe.rating && (
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
              {recipe.rating}
            </span>
          )}
          {recipe.servings > 0 && (
            <span className="flex items-center gap-1">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              {recipe.servings}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
```

### 5.3 Search Bar
Create `src/components/library/search-bar.tsx`:
```typescript
'use client'
import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = 'Search recipes...' }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
```

### 5.4 Sort Dropdown
Create `src/components/library/sort-dropdown.tsx`:
- Use shadcn/ui `Select`
- Options: Newest, Oldest, Prep time (shortest), Rating (highest)
- Controlled component, calls `onChange` with `SortOption` type

### 5.5 Category Filter
Create `src/components/library/category-filter.tsx`:
- Use shadcn/ui `DropdownMenu`
- Categories: All, Starter, Main, Dessert, Side, Breakfast, Snack
- Plus a "Favorites only" toggle
- Calls `onChange` with `FilterOption` type

### 5.6 Library Page
Create `src/app/library/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { MasonryGrid, MasonryItem } from '@/components/library/masonry-grid'
import { RecipeCard } from '@/components/library/recipe-card'
import { SearchBar } from '@/components/library/search-bar'
import { SortDropdown } from '@/components/library/sort-dropdown'
import { CategoryFilter } from '@/components/library/category-filter'
import { FloatingAddButton } from '@/components/add-recipe/fab'
import { AddRecipeModal } from '@/components/add-recipe/modal'
import type { Recipe } from '@/types'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // ... fetch recipes, render grid
}
```

**Features:**
- Server component fetches all user recipes
- Client-side search, filter, and sort (for MVP — all data loaded at once)
- Empty state: "No recipes yet! Click + to add your first recipe."
- FloatingAddButton always visible (bottom right)
- AddRecipeModal state controlled by client component wrapper

### 5.7 Recipe Detail View
Create `src/components/library/recipe-detail.tsx`:
- Full recipe view in a shadcn/ui `Sheet` (side panel) or `Dialog`
- Clean typographic layout:
  - Hero image at top
  - Title + category badge
  - Prep time, cook time, servings, difficulty
  - Rating component (interactive)
  - Favorite button (interactive)
  - Ingredients list (clean formatting)
  - Instructions (numbered steps)
  - Source URL (clickable, if present)
- Print button (opens browser print dialog)
- Close button

## Components to Create
- `src/components/library/masonry-grid.tsx`
- `src/components/library/recipe-card.tsx`
- `src/components/library/search-bar.tsx`
- `src/components/library/sort-dropdown.tsx`
- `src/components/library/category-filter.tsx`
- `src/components/library/recipe-detail.tsx`
- `src/app/library/page.tsx`

## Verification
- [x] Masonry grid renders with CSS columns (responsive: 1-4 columns)
- [x] Cards show hero image, title, category badge, time, rating
- [x] Search filters by title + ingredients
- [x] Category + favorites filter works
- [x] Sort options work (newest, oldest, prep time, rating)
- [x] Empty state shown when no recipes
- [x] Click card opens detail view (Sheet)
- [x] Print button wired to browser print dialog
- [x] Build verification passed (`npm run build`)
- [ ] End-to-end manual verification against real user recipe data

## Phase 5 Implementation Notes (April 17, 2026)
- Implemented `src/components/library/library-view.tsx` as the client wrapper for search/filter/sort state, optimistic local patching, and detail open/close handling.
- Kept `/library` as a server page that fetches user-scoped recipes, then hydrates into the client library view for MVP simplicity.
- Added dedicated components for masonry grid, search bar, sort dropdown, category/favorites filter menu, recipe card, and recipe detail sheet.
