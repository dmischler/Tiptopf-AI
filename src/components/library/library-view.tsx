'use client'

import { Dices, SearchX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  deleteRecipeAction,
  listRecipesAction,
  purgeTrashedRecipeImageAction,
  restoreRecipe,
} from '@/app/actions/recipe'
import { listCollectionsAction } from '@/app/actions/collections'

import { AddRecipeModal } from '@/components/add-recipe/modal'
import { ExpandableFab } from '@/components/add-recipe/expandable-fab'
import { FilterBar } from '@/components/library/filter-bar'
import { RandomRecipeDrawer } from '@/components/library/random-recipe-drawer'
import { MasonryGrid, MasonryItem } from '@/components/library/masonry-grid'
import { RecipeCard } from '@/components/library/recipe-card'
import { RecipeDetail } from '@/components/library/recipe-detail'
import { SortDropdown } from '@/components/library/sort-dropdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PullToRefresh } from '@/components/ui/pull-to-refresh'
import type { Collection, Difficulty, Recipe, RecipeCategory, SortOption } from '@/types'

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
    | 'notes'
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
  const [activeCategory, setActiveCategory] = useState<RecipeCategory | null>(null)
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [maxTime, setMaxTime] = useState<number | null>(null)
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [isDrawOpen, setIsDrawOpen] = useState(false)
  const [drawKey, setDrawKey] = useState(0)
  const [drawPool, setDrawPool] = useState<Recipe[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [addMode, setAddMode] = useState<'image' | 'url' | 'manual'>('image')
  const pendingDeletionRef = useRef<PendingDeletion | null>(null)

  const maxTimeLimit = useMemo(() => {
    const maxTotal = recipes.reduce((currentMax, recipe) => {
      const total = recipe.prep_time + recipe.cook_time
      return total > currentMax ? total : currentMax
    }, 0)

    return Math.max(180, maxTotal)
  }, [recipes])

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

      if (activeDifficulty && recipe.difficulty !== activeDifficulty) {
        return false
      }

      if (favoritesOnly && !recipe.is_favorite) {
        return false
      }

      if (maxTime !== null && recipe.prep_time + recipe.cook_time > maxTime) {
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
      const notesText = (recipe.notes ?? '').toLowerCase()
      return (
        recipe.title.toLowerCase().includes(query) ||
        ingredientsText.includes(query) ||
        tagsText.includes(query) ||
        notesText.includes(query)
      )
    })
  }, [activeCategory, activeDifficulty, activeTags, favoritesOnly, maxTime, recipes, searchTerm])

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

  // Note: deletion is now immediate (durable across navigation/refresh).
  // The 30s window only controls availability of the in-memory undo opportunity.
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
            return insertRecipeAt(current, restored as Recipe, pending.index)
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
    // Force-commit any still-pending previous deletion (harmless now that deletes are immediate).
    const previousPending = pendingDeletionRef.current
    if (previousPending) {
      clearTimeout(previousPending.timeoutId)
      pendingDeletionRef.current = null
      void purgeTrashedRecipeImageAction(previousPending.recipe.id).catch(() => {
        /* already purged or race — ignore */
      })
    }

    const removedIndex = recipes.findIndex((item) => item.id === recipe.id)
    if (removedIndex < 0) {
      return
    }

    // Optimistic removal from UI (same as before).
    setRecipes((current) => current.filter((item) => item.id !== recipe.id))
    setSelectedRecipeId((currentSelected) => (currentSelected === recipe.id ? null : currentSelected))

    // Immediate persistent delete. Success toast + undo window only appear if the server action succeeds.
    void deleteRecipeAction(recipe.id)
      .then(() => {
        const timeoutId = setTimeout(() => {
          if (pendingDeletionRef.current?.recipe.id === recipe.id) {
            pendingDeletionRef.current = null
            void purgeTrashedRecipeImageAction(recipe.id).catch(() => undefined)
          }
        }, 30_000)

        pendingDeletionRef.current = {
          recipe,
          index: removedIndex,
          timeoutId,
        }

        toast.success('Rezept gelöscht', {
          duration: 30_000,
          action: {
            label: 'Rückgängig',
            onClick: () => handleUndoDelete(recipe.id),
          },
        })
      })
      .catch((error) => {
        // Delete failed — restore UI immediately, no success toast, no undo entry.
        setRecipes((current) => insertRecipeAt(current, recipe, removedIndex))
        const message = error instanceof Error ? error.message : 'Löschen fehlgeschlagen.'
        toast.error(message)
      })
  }

  function handleTagToggle(tag: string) {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    )
  }

  function handleOpenRandomDraw() {
    if (recipes.length === 0) {
      toast.error('Noch keine Rezepte vorhanden.')
      return
    }

    const pool = filteredRecipes.length > 0 ? filteredRecipes : recipes

    if (filteredRecipes.length === 0 && recipes.length > 0) {
      toast.info('Keine Rezepte passen zu den Filtern – zeige ein zufälliges Rezept')
    }

    setDrawPool(pool)
    setDrawKey((k) => k + 1)
    setIsDrawOpen(true)
  }

  function handleRecipeSelected(recipe: Recipe) {
    setSelectedRecipeId(recipe.id)
  }

  async function handleRefresh() {
    try {
      const [freshRecipes, freshCollections] = await Promise.all([
        listRecipesAction(),
        listCollectionsAction(),
      ])

      setRecipes(freshRecipes as Recipe[])
      setCollections(freshCollections as Collection[])

      // Close detail if the recipe no longer exists after refresh
      if (selectedRecipeId && !freshRecipes.some((r) => r.id === selectedRecipeId)) {
        setSelectedRecipeId(null)
      }
      // Keep search, filters, and sort — user expects their current view to survive
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Aktualisieren fehlgeschlagen.'
      toast.error(message)
      throw err
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))] md:pb-8 sm:px-6 lg:px-8">
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Deine Bibliothek</h1>
            <p className="text-sm text-muted-foreground">
              {recipes.length} Rezept{recipes.length === 1 ? '' : 'e'} in deiner persönlichen Sammlung.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenRandomDraw}
            className="hidden gap-2 md:inline-flex"
          >
            <Dices className="h-4 w-4" />
            Zufallsrezept ziehen
          </Button>
        </div>

        <div className="space-y-3 mb-3">
          <FilterBar
            search={searchTerm}
            onSearchChange={setSearchTerm}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            activeTags={activeTags}
            onTagToggle={handleTagToggle}
            maxTime={maxTime}
            maxTimeLimit={maxTimeLimit}
            onMaxTimeChange={setMaxTime}
            availableTags={availableTags}
            activeDifficulty={activeDifficulty}
            onDifficultyChange={setActiveDifficulty}
            favoritesOnly={favoritesOnly}
            onFavoritesOnlyToggle={() => setFavoritesOnly((v) => !v)}
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
      </PullToRefresh>

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
        allTags={availableTags}
      />

      <RandomRecipeDrawer
        isOpen={isDrawOpen}
        onClose={() => setIsDrawOpen(false)}
        recipes={drawPool}
        onRecipeSelected={handleRecipeSelected}
        drawKey={drawKey}
      />

      <ExpandableFab
        onRandom={handleOpenRandomDraw}
        onManual={() => {
          setAddMode('manual')
          setAddOpen(true)
        }}
        onUrl={() => {
          setAddMode('url')
          setAddOpen(true)
        }}
        onImage={() => {
          setAddMode('image')
          setAddOpen(true)
        }}
      />

      <AddRecipeModal
        open={addOpen}
        onOpenChange={setAddOpen}
        initialMode={addMode}
        allTags={availableTags}
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
