'use client'

import Image from 'next/image'
import { Clock, UtensilsCrossed } from 'lucide-react'

import { FavoriteButton } from '@/components/interactions/favorite-button'
import { Rating } from '@/components/interactions/rating'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Recipe } from '@/types'

type RecipeCardProps = {
  recipe: Recipe
  onOpen: () => void
  onFavoriteChange?: (value: boolean) => void
  onRatingChange?: (value: number | null) => void
}

const CATEGORY_CLASS: Record<Recipe['category'], string> = {
  starter: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  main: 'bg-amber-500/20 text-amber-800 dark:text-amber-300',
  dessert: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  side: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  breakfast: 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-300',
  snack: 'bg-orange-500/20 text-orange-800 dark:text-orange-300',
}

function formatTotalTime(prepTime: number, cookTime: number) {
  const total = prepTime + cookTime
  return total > 0 ? `${total} min` : 'No time set'
}

function formatCategoryLabel(category: Recipe['category']) {
  return category[0].toUpperCase() + category.slice(1)
}

function formatDifficultyLabel(difficulty: Recipe['difficulty']) {
  return difficulty[0].toUpperCase() + difficulty.slice(1)
}

export function RecipeCard({ recipe, onOpen, onFavoriteChange, onRatingChange }: RecipeCardProps) {
  return (
    <Card
      className="cursor-pointer py-0 transition duration-150 hover:-translate-y-0.5 hover:shadow-lg"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      {recipe.image_url ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </div>
      ) : null}

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-base font-semibold leading-tight">{recipe.title}</h3>
          <FavoriteButton
            recipeId={recipe.id}
            isFavorite={recipe.is_favorite}
            size="sm"
            className="-mr-1 -mt-1"
            onOptimisticChange={onFavoriteChange}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className={CATEGORY_CLASS[recipe.category]}>{formatCategoryLabel(recipe.category)}</Badge>
          <Badge variant="outline">{formatDifficultyLabel(recipe.difficulty)}</Badge>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatTotalTime(recipe.prep_time, recipe.cook_time)}
          </span>
          {recipe.servings > 0 ? (
            <span className="inline-flex items-center gap-1">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              {recipe.servings}
            </span>
          ) : null}
        </div>

        <Rating
          recipeId={recipe.id}
          initialRating={recipe.rating}
          size="sm"
          onOptimisticChange={onRatingChange}
        />
      </CardContent>
    </Card>
  )
}
