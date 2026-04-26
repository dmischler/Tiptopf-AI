'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  deleteCollectionAction,
  addRecipeToCollectionAction,
  removeRecipeFromCollectionAction,
  updateCollectionAction,
} from '@/app/actions/collections'
import { RecipeCard } from '@/components/library/recipe-card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MasonryGrid, MasonryItem } from '@/components/library/masonry-grid'
import type { Collection, Recipe } from '@/types'

interface CollectionDetailViewProps {
  collection: Collection
  allRecipes: Recipe[]
}

export function CollectionDetailView({ collection, allRecipes }: CollectionDetailViewProps) {
  const router = useRouter()
  const [currentCollection, setCurrentCollection] = useState<Collection>(collection)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(collection.name)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)

  const collectionRecipes = useMemo(() => {
    return allRecipes.filter((recipe) => currentCollection.recipe_ids.includes(recipe.id))
  }, [allRecipes, currentCollection])

  const availableRecipes = useMemo(() => {
    return allRecipes.filter((recipe) => !currentCollection.recipe_ids.includes(recipe.id))
  }, [allRecipes, currentCollection])

  const filteredAvailableRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return availableRecipes
    return availableRecipes.filter(
      (recipe) =>
        recipe.title.toLowerCase().includes(query) ||
        recipe.ingredients.join(' ').toLowerCase().includes(query)
    )
  }, [availableRecipes, searchQuery])

  async function handleAddRecipe(recipeId: string) {
    try {
      const updated = await addRecipeToCollectionAction(currentCollection.id, recipeId)
      setCurrentCollection(updated)
      toast.success('Rezept hinzugefügt.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hinzufügen fehlgeschlagen.'
      toast.error(message)
    }
  }

  async function handleRemoveRecipe(recipeId: string) {
    try {
      const updated = await removeRecipeFromCollectionAction(currentCollection.id, recipeId)
      setCurrentCollection(updated)
      toast.success('Rezept entfernt.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Entfernen fehlgeschlagen.'
      toast.error(message)
    }
  }

  async function handleDeleteCollection() {
    try {
      await deleteCollectionAction(currentCollection.id)
      toast.success('Sammlung gelöscht.')
      router.push('/collections')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Löschen fehlgeschlagen.'
      toast.error(message)
    }
  }

  async function handleUpdateName() {
    const name = editName.trim()
    if (!name) {
      toast.error('Name darf nicht leer sein.')
      return
    }
    try {
      const updated = await updateCollectionAction(currentCollection.id, name)
      setCurrentCollection(updated)
      setIsEditingName(false)
      toast.success('Name aktualisiert.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Aktualisierung fehlgeschlagen.'
      toast.error(message)
    }
  }

  const selectedRecipe = allRecipes.find((r) => r.id === selectedRecipeId) ?? null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.push('/collections')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {isEditingName ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="max-w-sm"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleUpdateName()
                }
              }}
            />
            <Button onClick={() => void handleUpdateName()}>Speichern</Button>
            <Button variant="outline" onClick={() => { setIsEditingName(false); setEditName(currentCollection.name); }}>
              Abbrechen
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">{currentCollection.name}</h1>
            <Button variant="ghost" size="sm" onClick={() => setIsEditingName(true)}>
              Bearbeiten
            </Button>
          </>
        )}
        <Button
          variant="destructive"
          size="sm"
          className="ml-auto"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Löschen
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {collectionRecipes.length} Rezept{collectionRecipes.length === 1 ? '' : 'e'}
        </p>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Rezept hinzufügen
        </Button>
      </div>

      {collectionRecipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <Plus className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">Noch keine Rezepte</p>
            <p className="text-sm text-muted-foreground">
              Füge Rezepte zu dieser Sammlung hinzu.
            </p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Rezept hinzufügen
          </Button>
        </div>
      ) : (
        <MasonryGrid>
          {collectionRecipes.map((recipe, index) => (
            <MasonryItem key={recipe.id}>
              <div className="relative">
                <RecipeCard
                  recipe={recipe}
                  index={index}
                  onOpen={() => setSelectedRecipeId(recipe.id)}
                />
                <button
                  onClick={() => void handleRemoveRecipe(recipe.id)}
                  className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </MasonryItem>
          ))}
        </MasonryGrid>
      )}

      {/* Add Recipe Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="w-full max-w-2xl p-0 sm:max-w-2xl max-h-[80vh]">
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
            <DialogTitle>Rezept hinzufügen</DialogTitle>
            <DialogDescription>
              Wähle ein Rezept aus, das zur Sammlung hinzugefügt werden soll.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Rezepte suchen..."
                className="pl-9"
              />
            </div>
            {filteredAvailableRecipes.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {searchQuery.trim()
                  ? 'Keine passenden Rezepte gefunden.'
                  : 'Alle Rezepte sind bereits in dieser Sammlung.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-h-[50vh] overflow-y-auto">
                {filteredAvailableRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => {
                      void handleAddRecipe(recipe.id)
                      setIsAddModalOpen(false)
                      setSearchQuery('')
                    }}
                    className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/25 p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    {recipe.image_url ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Plus className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{recipe.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {recipe.prep_time + recipe.cook_time} min
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-full max-w-md p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
            <DialogTitle>Sammlung löschen?</DialogTitle>
            <DialogDescription>
              Bist du sicher, dass du diese Sammlung löschen möchtest? Die Rezepte bleiben erhalten.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 px-5 py-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteCollection()}>
              Löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipe Detail */}
      {selectedRecipeId && selectedRecipe && (
        <Dialog
          open={Boolean(selectedRecipeId)}
          onOpenChange={(open) => {
            if (!open) setSelectedRecipeId(null)
          }}
        >
          <DialogContent className="w-full max-w-2xl gap-0 p-0 sm:max-w-2xl">
            <DialogHeader className="gap-2 border-b border-border/70 px-5 pb-2 pt-4 pr-12">
              <DialogTitle className="text-lg leading-tight">{selectedRecipe.title}</DialogTitle>
            </DialogHeader>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedRecipe.ingredients.length} Zutaten · {selectedRecipe.prep_time + selectedRecipe.cook_time} min
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRecipeId(null)
                  router.push(`/library`)
                }}
              >
                In Bibliothek öffnen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </main>
  )
}
