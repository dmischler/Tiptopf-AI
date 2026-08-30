'use client'

import { Star } from 'lucide-react'
import { useOptimistic, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { setRating } from '@/app/actions/recipe'
import { cn } from '@/lib/utils'

type RatingProps = {
  recipeId: string
  initialRating: number | null
  size?: 'sm' | 'md'
  className?: string
  onOptimisticChange?: (rating: number | null) => void
}

const STAR_SIZE_CLASS = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
} as const

export function Rating({
  recipeId,
  initialRating,
  size = 'md',
  className,
  onOptimisticChange,
}: RatingProps) {
  const [hover, setHover] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [rating, setRatingOptimistic] = useOptimistic(initialRating ?? 0, (_, next: number) => next)

  function handleRate(star: number) {
    const nextRating = star === rating ? 0 : star
    setRatingOptimistic(nextRating)
    onOptimisticChange?.(nextRating === 0 ? null : nextRating)

    startTransition(async () => {
      try {
        await setRating(recipeId, nextRating)
      } catch (error) {
        setRatingOptimistic(rating)
        onOptimisticChange?.(rating === 0 ? null : rating)
        const message = error instanceof Error ? error.message : 'Failed to update rating.'
        toast.error(message)
      }
    })
  }

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      onMouseLeave={() => setHover(0)}
      aria-label="Recipe rating"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= (hover || rating)

        return (
          <button
            key={star}
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              handleRate(star)
            }}
            onMouseEnter={() => setHover(star)}
            disabled={isPending}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded p-1 transition-transform hover:scale-110 active:scale-110 touch-manipulation disabled:cursor-not-allowed"
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={cn(
                STAR_SIZE_CLASS[size],
                'transition-colors',
                active ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
