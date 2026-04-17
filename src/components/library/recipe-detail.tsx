'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Clock, ExternalLink, Printer, Timer, UtensilsCrossed } from 'lucide-react'

import { FavoriteButton } from '@/components/interactions/favorite-button'
import { Rating } from '@/components/interactions/rating'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Recipe } from '@/types'

type RecipeDetailProps = {
  recipe: Recipe | null
  open: boolean
  onOpenChange: (open: boolean) => void
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

function formatCategoryLabel(category: Recipe['category']) {
  return category[0].toUpperCase() + category.slice(1)
}

function formatDifficultyLabel(difficulty: Recipe['difficulty']) {
  return difficulty[0].toUpperCase() + difficulty.slice(1)
}

function toInstructionSteps(instructions: string) {
  const lines = instructions
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0 && instructions.trim()) {
    return [instructions.trim()]
  }

  return lines.map((line) => line.replace(/^\d+[.)]\s*/, ''))
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-3">
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="inline-flex items-center gap-2 text-sm font-medium">
        {icon}
        {value}
      </div>
    </div>
  )
}

export function RecipeDetail({
  recipe,
  open,
  onOpenChange,
  onFavoriteChange,
  onRatingChange,
}: RecipeDetailProps) {
  if (!recipe) {
    return null
  }

  const instructionSteps = toInstructionSteps(recipe.instructions)
  const totalTime = recipe.prep_time + recipe.cook_time

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl" showCloseButton>
        {recipe.image_url ? (
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={recipe.image_url}
              alt={recipe.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 640px"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground">
            No image available
          </div>
        )}

        <SheetHeader className="gap-3 p-5 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              <SheetTitle className="text-xl leading-tight">{recipe.title}</SheetTitle>
              <div className="flex flex-wrap gap-2">
                <Badge className={CATEGORY_CLASS[recipe.category]}>{formatCategoryLabel(recipe.category)}</Badge>
                <Badge variant="outline">{formatDifficultyLabel(recipe.difficulty)}</Badge>
              </div>
            </div>

            <FavoriteButton
              recipeId={recipe.id}
              isFavorite={recipe.is_favorite}
              size="md"
              onOptimisticChange={onFavoriteChange}
            />
          </div>

          <SheetDescription className="pt-1">
            Keep this panel open while exploring your recipe details and source.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-5 pb-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <InfoItem
              label="Prep"
              value={recipe.prep_time > 0 ? `${recipe.prep_time} min` : '—'}
              icon={<Timer className="h-4 w-4 text-muted-foreground" />}
            />
            <InfoItem
              label="Cook"
              value={recipe.cook_time > 0 ? `${recipe.cook_time} min` : '—'}
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            />
            <InfoItem
              label="Total"
              value={totalTime > 0 ? `${totalTime} min` : '—'}
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            />
            <InfoItem
              label="Servings"
              value={recipe.servings > 0 ? String(recipe.servings) : '—'}
              icon={<UtensilsCrossed className="h-4 w-4 text-muted-foreground" />}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Your rating</div>
            <Rating
              recipeId={recipe.id}
              initialRating={recipe.rating}
              size="md"
              onOptimisticChange={onRatingChange}
            />
          </div>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ingredients</h4>
            <ul className="space-y-2">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={`${ingredient}-${index}`} className="rounded-md border border-border/70 bg-background/40 px-3 py-2 text-sm">
                  {ingredient}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Instructions</h4>
            <ol className="space-y-3">
              {instructionSteps.map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-3 text-sm leading-relaxed">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>

            {recipe.source_url ? (
              <Button type="button" variant="outline" render={<Link href={recipe.source_url} target="_blank" rel="noreferrer" />}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open source
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
