# Phase 6: Interactions (Favorites & Ratings)

**Duration:** ~1 hour  
**Goal:** Heart favorite toggle, star rating, optimistic UI updates, all per-user

## Steps

### 6.1 Favorite Toggle with Optimistic UI
Create `src/components/interactions/favorite-button.tsx`:
```typescript
'use client'
import { Heart } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toggleFavorite } from '@/app/actions/recipe'

interface FavoriteButtonProps {
  recipeId: string
  isFavorite: boolean
}

export function FavoriteButton({ recipeId, isFavorite }: FavoriteButtonProps) {
  const [favorite, setFavorite] = useState(isFavorite)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    // Optimistic update — immediately reflect in UI
    const newValue = !favorite
    setFavorite(newValue)
    
    startTransition(async () => {
      try {
        await toggleFavorite(recipeId, newValue)
      } catch {
        // Revert on error
        setFavorite(!newValue)
      }
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className="p-2 rounded-full hover:bg-cardHover transition-colors"
      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        className={`w-6 h-6 transition-colors ${
          favorite ? 'fill-rose-500 text-rose-500' : 'text-muted'
        }`}
      />
    </button>
  )
}
```

### 6.2 Rating Component with Optimistic UI
Create `src/components/interactions/rating.tsx`:
```typescript
'use client'
import { Star } from 'lucide-react'
import { useState, useTransition } from 'react'
import { setRating } from '@/app/actions/recipe'

interface RatingProps {
  recipeId: string
  initialRating: number | null
  size?: 'sm' | 'md'
}

export function Rating({ recipeId, initialRating, size = 'md' }: RatingProps) {
  const [rating, setRatingState] = useState(initialRating ?? 0)
  const [hover, setHover] = useState(0)
  const [isPending, startTransition] = useTransition()
  const starSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  const handleRate = (star: number) => {
    // Optimistic update
    const newRating = star === rating ? 0 : star // Click same star = clear rating
    setRatingState(newRating)
    
    startTransition(async () => {
      try {
        await setRating(recipeId, newRating)
      } catch {
        setRatingState(initialRating ?? 0) // Revert on error
      }
    })
  }

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => handleRate(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          disabled={isPending}
          className="p-0.5 hover:scale-110 transition-transform"
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <Star
            className={`${starSize} transition-colors ${
              star <= (hover || rating)
                ? 'fill-yellow-500 text-yellow-500'
                : 'text-muted'
            }`}
          />
        </button>
      ))}
    </div>
  )
}
```

### 6.3 Server Actions for Interactions
Create `src/app/actions/recipe.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleFavorite(recipeId: string, isFavorite: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('recipes')
    .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
    .eq('id', recipeId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/library')
}

export async function setRating(recipeId: string, rating: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('recipes')
    .update({ rating: rating === 0 ? null : rating, updated_at: new Date().toISOString() })
    .eq('id', recipeId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/library')
}
```

> **Note:** The `rating` field in the database is `NUMERIC(2,1) DEFAULT NULL`. Setting rating to 0 clears it (sets to NULL). Both `toggleFavorite` and `setRating` verify `user_id` ownership as an extra safety check (RLS also enforces this).

### 6.4 Wire Interactions into Existing Components
- Add `FavoriteButton` to `RecipeCard` (replaces inline Heart)
- Add `FavoriteButton` to `RecipeDetail`
- Add `Rating` component to `RecipeDetail`
- Add `Rating` component to `RecipeCard` (small variant)

## Components to Create
- `src/components/interactions/favorite-button.tsx`
- `src/components/interactions/rating.tsx`
- `src/app/actions/recipe.ts`

## Components to Modify
- `src/components/library/recipe-card.tsx` — use FavoriteButton + Rating
- `src/components/library/recipe-detail.tsx` — use FavoriteButton + Rating

## Verification
- [ ] Heart toggles favorite state with optimistic UI (no flicker)
- [ ] Stars allow 1-5 rating with optimistic UI
- [ ] Clicking current star rating clears it (sets to null)
- [ ] Changes persist to database
- [ ] Error states revert optimistic updates
- [ ] Favorite and rating filters work in library