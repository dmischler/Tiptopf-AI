'use client'

import { SearchX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { deleteRecipeAction, restoreRecipe } from '@/app/actions/recipe'

import { AddRecipeLauncher } from '@/components/add-recipe/launcher'
import { FilterBar } from '@/components/library/filter-bar'
import { MasonryGrid, MasonryItem } from '@/components/library/masonry-grid'
import { RecipeCard } from '@/components/library/recipe-card'
import { RecipeDetail } from '@/components/library/recipe-detail'
import { SortDropdown } from '@/components/library/sort-dropdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Collection, Recipe, SortOption } from '@/types'

type LibraryViewProps = {
  initialRecipes: Recipe[]
  initialCollections?: Collection[]
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
    | 'tags'
  >
>

type PendingDeletion = {
  recipe: Recipe
  index: number
  timeoutId: ReturnType<typeof setTimeout>
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

export function LibraryView({ initialRecipes, initialCollections = [] }: LibraryViewProps) {
  const [recipes, setRecipes] = useState(initialRecipes)
  const [collections, setCollections] = useState(initialCollections)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [showQuickFilter, setShowQuickFilter] = useState(false)
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

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const recipe of recipes) {
      for (const tag of recipe.tags) {
        tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  }, [recipes])

  const filteredRecipes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return recipes.filter((recipe) => {
      if (activeCategory && recipe.category !== activeCategory) {
        return false
      }

      if (showQuickFilter && recipe.prep_time + recipe.cook_time >= 30) {
        return false
      }

      if (activeTags.length > 0) {
        const hasAllTags = activeTags.every((tag) => recipe.tags.includes(tag))
        if (!hasAllTags) {
          return false
        }
      }

      if (!query) {
        return true
      }

      const ingredientsText = recipe.ingredients.join(' ').toLowerCase()
      const tagsText = recipe.tags.join(' ').toLowerCase()
      return (
        recipe.title.toLowerCase().includes(query) ||
        ingredientsText.includes(query) ||
        tagsText.includes(query)
      )
    })
  }, [activeCategory, activeTags, recipes, searchTerm, showQuickFilter])

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
        const message = error instanceof Error ? error.message : 'Rezept konnte nicht wiederhergestellt werden.'
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
        const message = error instanceof Error ? error.message : 'Wiederherstellen fehlgeschlagen.'
        toast.error(message)
      })
  }

  function handleDeleteRequested(recipe: Recipe) {
    const previousPending = pendingDeletionRef.current
    if (previousPending) {
      clearTimeout(previousPending.timeoutId)
      pendingDeletionRef.current = null

      void deleteRecipeAction(previousPending.recipe.id).catch((error) => {
        const message = error instanceof Error ? error.message : 'Löschen fehlgeschlagen.'
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

    toast.success('Rezept gelöscht', {
      duration: 30_000,
      action: {
        label: 'Rückgängig',
        onClick: () => handleUndoDelete(recipe.id),
      },
    })
  }

  function handleTagToggle(tag: string) {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Deine Bibliothek</h1>
          <p className="text-sm text-muted-foreground">
            {recipes.length} Rezept{recipes.length === 1 ? '' : 'e'} in deiner persönlichen Sammlung.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <FilterBar
          search={searchTerm}
          onSearchChange={setSearchTerm}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          activeTags={activeTags}
          onTagToggle={handleTagToggle}
          showQuickFilter={showQuickFilter}
          onQuickFilterToggle={() => setShowQuickFilter((current) => !current)}
          availableTags={availableTags}
          recipes={recipes}
        />
        <div className="flex justify-end">
          <SortDropdown value={sortOption} onChange={setSortOption} />
        </div>
      </div>

      {recipes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Noch keine Rezepte</CardTitle>
            <CardDescription>
              Füge dein erstes Rezept aus einem Bild oder einer URL hinzu.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : visibleRecipes.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <SearchX className="h-5 w-5" />
            Deine aktuellen Such- und Filtereinstellungen ergeben keine Rezepte.
          </CardContent>
        </Card>
      ) : (
        <MasonryGrid>
          {visibleRecipes.map((recipe, index) => (
            <MasonryItem key={recipe.id}>
              <RecipeCard
                recipe={recipe}
                index={index}
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
        collections={collections}
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
