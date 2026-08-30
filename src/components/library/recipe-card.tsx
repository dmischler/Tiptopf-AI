'use client'

import Image from 'next/image'
import { Clock, UtensilsCrossed } from 'lucide-react'

import { FavoriteButton } from '@/components/interactions/favorite-button'
import { Rating } from '@/components/interactions/rating'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toRecipeImageSrc } from '@/lib/recipe-image'
import type { Difficulty, Recipe, RecipeCategory } from '@/types'

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  starter: 'Vorspeise',
  main: 'Hauptgericht',
  dessert: 'Dessert',
  side: 'Beilage',
  breakfast: 'Frühstück',
  snack: 'Snack',
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Schwer',
}

type RecipeCardProps = {
  recipe: Recipe
  index?: number
  onOpen: () => void
  onFavoriteChange?: (value: boolean) => void
  onRatingChange?: (value: number | null) => void
}

const CATEGORY_CLASS: Record<Recipe['category'], string> = {
  starter: 'bg-cyan-500/15 text-cyan-300',
  main: 'bg-amber-500/20 text-amber-300',
  dessert: 'bg-rose-500/15 text-rose-300',
  side: 'bg-emerald-500/15 text-emerald-300',
  breakfast: 'bg-yellow-500/20 text-yellow-300',
  snack: 'bg-orange-500/20 text-orange-300',
}

function formatTotalTime(prepTime: number, cookTime: number) {
  const total = prepTime + cookTime
  return total > 0 ? `${total} min` : 'No time set'
}

function formatCategoryLabel(category: Recipe['category']) {
  return CATEGORY_LABELS[category]
}

function formatDifficultyLabel(difficulty: Recipe['difficulty']) {
  return DIFFICULTY_LABELS[difficulty]
}

export function RecipeCard({ recipe, index = 0, onOpen, onFavoriteChange, onRatingChange }: RecipeCardProps) {
  const imageSrc = toRecipeImageSrc(recipe)

  return (
    <Card
      className="cursor-pointer py-0 transition duration-150 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.985] active:shadow-md"
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
      {imageSrc ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[4/3]">
          <Image
            src={imageSrc}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            priority={index < 4}
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

        {recipe.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                {tag}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                +{recipe.tags.length - 3}
              </span>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {formatTotalTime(recipe.prep_time, recipe.cook_time)}
          </span>
          {recipe.servings > 0 ? (
            <span className="inline-flex items-center gap-1">
              <UtensilsCrossed className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
