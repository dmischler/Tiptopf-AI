'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { createCollectionAction } from '@/app/actions/collections'
import { CollectionCard } from '@/components/collections/collection-card'
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
import { toRecipeImageSrc } from '@/lib/recipe-image'
import type { Collection, Recipe } from '@/types'

interface CollectionsViewProps {
  collections: Collection[]
  recipes: Recipe[]
}

export function CollectionsView({ collections, recipes }: CollectionsViewProps) {
  const router = useRouter()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  function getRecipeCount(collection: Collection) {
    return collection.recipe_ids.length
  }

  function getCoverImage(collection: Collection): string | null {
    const firstRecipeId = collection.recipe_ids[0]
    if (!firstRecipeId) return null
    const recipe = recipes.find((r) => r.id === firstRecipeId)
    return recipe ? toRecipeImageSrc(recipe) : null
  }

  async function handleCreateCollection() {
    const name = newCollectionName.trim()
    if (!name) {
      toast.error('Bitte gib einen Namen ein.')
      return
    }

    setIsCreating(true)
    try {
      await createCollectionAction(name)
      setNewCollectionName('')
      setIsCreateModalOpen(false)
      toast.success('Sammlung erstellt.')
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erstellen fehlgeschlagen.'
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pt-8 pb-[max(6rem,env(safe-area-inset-bottom))] standalone:pt-4 nav-top:pb-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Sammlungen</h1>
          <p className="text-sm text-muted-foreground">
            {collections.length} Sammlung{collections.length === 1 ? '' : 'en'}
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Sammlung
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <FolderPlus className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">Noch keine Sammlungen</p>
            <p className="text-sm text-muted-foreground">
              Erstelle deine erste Sammlung, um Rezepte zu gruppieren.
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Erste Sammlung erstellen
          </Button>
        </div>
      ) : (
        <MasonryGrid>
          {collections.map((collection) => (
            <MasonryItem key={collection.id}>
              <CollectionCard
                collection={collection}
                recipeCount={getRecipeCount(collection)}
                coverImage={getCoverImage(collection)}
                onClick={() => router.push(`/collections/${collection.id}`)}
              />
            </MasonryItem>
          ))}
        </MasonryGrid>
      )}

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="w-full p-0 nav-top:max-w-md">
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
            <DialogTitle>Neue Sammlung</DialogTitle>
            <DialogDescription>
              Gib einen Namen für die neue Sammlung ein.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <Input
              value={newCollectionName}
              onChange={(event) => setNewCollectionName(event.target.value)}
              placeholder="z.B. Wochenend-Rezepte"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleCreateCollection()
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={() => void handleCreateCollection()} disabled={isCreating}>
                Erstellen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
