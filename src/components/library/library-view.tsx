'use client'

import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { deleteRecipeAction, restoreRecipe } from '@/app/actions/recipe'

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

type RecipePatch = Partial<
  Pick<
    Recipe,
    | 'is_favorite'
    | 'rating'
    | 'title'
    | 'ingredients'
    | 'instructions'
    | 'prep_time'
    | 'cook_time'
    | 'servings'
    | 'category'
    | 'difficulty'
  >
>

type PendingDeletion = {
  recipe: Recipe
  index: number
  timeoutId: ReturnType<typeof setTimeout>
}

const DEFAULT_FILTER: CategoryFilterValue = {
  category: 'all',
  favoritesOnly: false,
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
  const [recipes, setRecipes] = useState(initialRecipes)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const [filterValue, setFilterValue] = useState<CategoryFilterValue>(DEFAULT_FILTER)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const pendingDeletionRef = useRef<PendingDeletion | null>(null)

  useEffect(() => {
    return () => {
      const pending = pendingDeletionRef.current
      if (pending) {
        clearTimeout(pending.timeoutId)
      }
    }
  }, [])

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

  function patchRecipe(recipeId: string, patch: RecipePatch) {
    setRecipes((current) =>
      current.map((recipe) => (recipe.id === recipeId ? { ...recipe, ...patch } : recipe))
    )
  }

  function insertRecipeAt(recipesList: Recipe[], recipe: Recipe, index: number) {
    const next = [...recipesList]
    const targetIndex = Math.max(0, Math.min(index, next.length))
    next.splice(targetIndex, 0, recipe)
    return next
  }

  function queueDeletion(recipe: Recipe, index: number) {
    const timeoutId = setTimeout(() => {
      const pending = pendingDeletionRef.current
      if (!pending || pending.recipe.id !== recipe.id) {
        return
      }

      pendingDeletionRef.current = null
      void deleteRecipeAction(recipe.id).catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to delete recipe.'
        setRecipes((current) => insertRecipeAt(current, recipe, index))
        toast.error(message)
      })
    }, 30_000)

    pendingDeletionRef.current = {
      recipe,
      index,
      timeoutId,
    }
  }

  function handleUndoDelete(recipeId: string) {
    const pending = pendingDeletionRef.current
    if (!pending || pending.recipe.id !== recipeId) {
      return
    }

    clearTimeout(pending.timeoutId)
    pendingDeletionRef.current = null

    setRecipes((current) => {
      if (current.some((item) => item.id === pending.recipe.id)) {
        return current
      }

      return insertRecipeAt(current, pending.recipe, pending.index)
    })

    void restoreRecipe(pending.recipe)
      .then((restored) => {
        setRecipes((current) => {
          const index = current.findIndex((item) => item.id === pending.recipe.id)
          if (index < 0) {
            return [restored as Recipe, ...current.filter((item) => item.id !== restored.id)]
          }

          const next = [...current]
          next[index] = restored as Recipe
          return next
        })

        setSelectedRecipeId((currentSelected) =>
          currentSelected === pending.recipe.id ? restored.id : currentSelected
        )
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to restore recipe.'
        toast.error(message)
      })
  }

  function handleDeleteRequested(recipe: Recipe) {
    const previousPending = pendingDeletionRef.current
    if (previousPending) {
      clearTimeout(previousPending.timeoutId)
      pendingDeletionRef.current = null

      void deleteRecipeAction(previousPending.recipe.id).catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to finalize previous deletion.'
        toast.error(message)
      })
    }

    const removedIndex = recipes.findIndex((item) => item.id === recipe.id)

    if (removedIndex < 0) {
      return
    }

    setRecipes((current) => current.filter((item) => item.id !== recipe.id))

    setSelectedRecipeId((currentSelected) => (currentSelected === recipe.id ? null : currentSelected))
    queueDeletion(recipe, removedIndex)

    toast.success('Recipe deleted', {
      duration: 30_000,
      action: {
        label: 'Undo',
        onClick: () => handleUndoDelete(recipe.id),
      },
    })
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
        <Button variant="outline" nativeButton={false} render={<Link href="/profile" />}>
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
        onRecipeUpdated={(updatedRecipe) => {
          setRecipes((current) =>
            current.map((item) => (item.id === updatedRecipe.id ? updatedRecipe : item))
          )
        }}
        onRecipeDeleteRequested={handleDeleteRequested}
      />

      <AddRecipeLauncher
        onRecipeSaved={(recipe) => {
          setRecipes((current) => [
            recipe,
            ...current.filter((item) => item.id !== recipe.id),
          ])
        }}
      />
    </main>
  )
}
