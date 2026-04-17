'use client'

import { Heart } from 'lucide-react'
import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'

import { toggleFavorite } from '@/app/actions/recipe'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type FavoriteButtonProps = {
  recipeId: string
  isFavorite: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onOptimisticChange?: (isFavorite: boolean) => void
}

const HEART_SIZE_CLASS = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const

export function FavoriteButton({
  recipeId,
  isFavorite,
  size = 'md',
  className,
  onOptimisticChange,
}: FavoriteButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [favorite, setFavoriteOptimistic] = useOptimistic(isFavorite, (_, next: boolean) => next)

  function handleToggle() {
    const nextValue = !favorite
    setFavoriteOptimistic(nextValue)
    onOptimisticChange?.(nextValue)

    startTransition(async () => {
      try {
        await toggleFavorite(recipeId, nextValue)
      } catch (error) {
        setFavoriteOptimistic(favorite)
        onOptimisticChange?.(favorite)
        const message = error instanceof Error ? error.message : 'Failed to update favorites.'
        toast.error(message)
      }
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn('rounded-full', className)}
      onClick={(event) => {
        event.stopPropagation()
        handleToggle()
      }}
      disabled={isPending}
      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favorite}
    >
      <Heart
        className={cn(
          HEART_SIZE_CLASS[size],
          'transition-colors',
          favorite ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'
        )}
      />
    </Button>
  )
}
