'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Clock, UtensilsCrossed } from 'lucide-react'

import { FavoriteButton } from '@/components/interactions/favorite-button'
import { Rating } from '@/components/interactions/rating'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CATEGORY_CLASS, CATEGORY_LABELS, DIFFICULTY_LABELS, formatTotalTime } from '@/lib/recipe-meta'
import { toRecipeImageSrc } from '@/lib/recipe-image'
import type { Recipe } from '@/types'

type RecipeCardProps = {
  recipe: Recipe
  index?: number
  onFavoriteChange?: (value: boolean) => void
  onRatingChange?: (value: number | null) => void
}

export function RecipeCard({ recipe, index = 0, onFavoriteChange, onRatingChange }: RecipeCardProps) {
  const imageSrc = toRecipeImageSrc(recipe)

  return (
    <Link
      href={`/library/${recipe.id}`}
      className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="py-0 transition duration-150 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.985] active:shadow-md">
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
            <Badge className={CATEGORY_CLASS[recipe.category]}>{CATEGORY_LABELS[recipe.category]}</Badge>
            <Badge variant="outline">{DIFFICULTY_LABELS[recipe.difficulty]}</Badge>
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
    </Link>
  )
}
