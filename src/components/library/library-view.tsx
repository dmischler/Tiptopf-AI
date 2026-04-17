'use client'

import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AddRecipeLauncher } from '@/components/add-recipe/launcher'
import {
  CategoryFilter,
  type CategoryFilterValue,
} from '@/components/library/category-filter'
import { MasonryGrid, MasonryItem } from '@/components/library/masonry-grid'
import { RecipeCard } from '@/components/library/recipe-card'
import { RecipeDetail } from '@/components/library/recipe-detail'
import { SearchBar } from '@/components/library/search-bar'
import { SortDropdown } from '@/components/library/sort-dropdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Recipe, SortOption } from '@/types'

type LibraryViewProps = {
  initialRecipes: Recipe[]
}

const DEFAULT_FILTER: CategoryFilterValue = {
  category: 'all',
  favoritesOnly: false,
}

function toSafeNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function normalizeSourceType(sourceType: unknown): Recipe['source_type'] {
  if (sourceType === 'image' || sourceType === 'url' || sourceType === 'manual') {
    return sourceType
  }

  return 'manual'
}

function normalizeRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((value) => String(value)).filter((value) => value.trim().length > 0)
      : [],
    prep_time: Math.max(0, Math.trunc(toSafeNumber(recipe.prep_time))),
    cook_time: Math.max(0, Math.trunc(toSafeNumber(recipe.cook_time))),
    servings: Math.max(0, Math.trunc(toSafeNumber(recipe.servings, 1))),
    rating:
      recipe.rating === null || recipe.rating === undefined
        ? null
        : Math.max(0, Math.min(5, toSafeNumber(recipe.rating))),
    is_favorite: Boolean(recipe.is_favorite),
    source_type: normalizeSourceType(recipe.source_type),
  }
}

function toMillis(iso: string) {
  const value = new Date(iso).getTime()
  return Number.isNaN(value) ? 0 : value
}

function sortRecipes(recipes: Recipe[], sortOption: SortOption) {
  const sorted = [...recipes]

  switch (sortOption) {
    case 'newest':
      sorted.sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at))
      break
    case 'oldest':
      sorted.sort((a, b) => toMillis(a.created_at) - toMillis(b.created_at))
      break
    case 'prep_time':
      sorted.sort((a, b) => a.prep_time - b.prep_time || toMillis(b.created_at) - toMillis(a.created_at))
      break
    case 'rating':
      sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || toMillis(b.created_at) - toMillis(a.created_at))
      break
  }

  return sorted
}

export function LibraryView({ initialRecipes }: LibraryViewProps) {
  const [recipes, setRecipes] = useState(() => initialRecipes.map(normalizeRecipe))
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const [filterValue, setFilterValue] = useState<CategoryFilterValue>(DEFAULT_FILTER)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)

  const filteredRecipes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return recipes.filter((recipe) => {
      if (filterValue.category !== 'all' && recipe.category !== filterValue.category) {
        return false
      }

      if (filterValue.favoritesOnly && !recipe.is_favorite) {
        return false
      }

      if (!query) {
        return true
      }

      const ingredientsText = recipe.ingredients.join(' ').toLowerCase()
      return recipe.title.toLowerCase().includes(query) || ingredientsText.includes(query)
    })
  }, [filterValue, recipes, searchTerm])

  const visibleRecipes = useMemo(
    () => sortRecipes(filteredRecipes, sortOption),
    [filteredRecipes, sortOption]
  )

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId]
  )

  function patchRecipe(
    recipeId: string,
    patch: Partial<Pick<Recipe, 'is_favorite' | 'rating'>>
  ) {
    setRecipes((current) =>
      current.map((recipe) => (recipe.id === recipeId ? { ...recipe, ...patch } : recipe))
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 pb-24 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your library</h1>
          <p className="text-sm text-muted-foreground">
            {recipes.length} recipe{recipes.length === 1 ? '' : 's'} across your personal collection.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/profile" />}>
          Profile settings
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
        <SortDropdown value={sortOption} onChange={setSortOption} />
        <CategoryFilter value={filterValue} onChange={setFilterValue} />
      </div>

      {recipes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No recipes yet</CardTitle>
            <CardDescription>
              Click the floating + button to add your first recipe from an image or URL.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : visibleRecipes.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <SearchX className="h-5 w-5" />
            No recipes match your current search and filter settings.
          </CardContent>
        </Card>
      ) : (
        <MasonryGrid>
          {visibleRecipes.map((recipe) => (
            <MasonryItem key={recipe.id}>
              <RecipeCard
                recipe={recipe}
                onOpen={() => setSelectedRecipeId(recipe.id)}
                onFavoriteChange={(value) => patchRecipe(recipe.id, { is_favorite: value })}
                onRatingChange={(value) => patchRecipe(recipe.id, { rating: value })}
              />
            </MasonryItem>
          ))}
        </MasonryGrid>
      )}

      <RecipeDetail
        recipe={selectedRecipe}
        open={Boolean(selectedRecipe)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedRecipeId(null)
          }
        }}
        onFavoriteChange={(value) => {
          if (!selectedRecipe) return
          patchRecipe(selectedRecipe.id, { is_favorite: value })
        }}
        onRatingChange={(value) => {
          if (!selectedRecipe) return
          patchRecipe(selectedRecipe.id, { rating: value })
        }}
      />

      <AddRecipeLauncher
        onRecipeSaved={(recipe) => {
          const normalizedRecipe = normalizeRecipe(recipe)
          setRecipes((current) => [
            normalizedRecipe,
            ...current.filter((item) => item.id !== normalizedRecipe.id),
          ])
        }}
      />
    </main>
  )
}
