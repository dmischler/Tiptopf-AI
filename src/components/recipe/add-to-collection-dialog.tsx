'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { addRecipeToCollectionAction, createCollectionAction } from '@/app/actions/collections'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Collection } from '@/types'

type AddToCollectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipeId: string
  collections: Collection[]
  onCollectionsChange: (collections: Collection[]) => void
}

export function AddToCollectionDialog({
  open,
  onOpenChange,
  recipeId,
  collections,
  onCollectionsChange,
}: AddToCollectionDialogProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')

  async function handleAddToCollection(collectionId: string) {
    try {
      await addRecipeToCollectionAction(collectionId, recipeId)
      onCollectionsChange(
        collections.map((collection) =>
          collection.id === collectionId && !collection.recipe_ids.includes(recipeId)
            ? { ...collection, recipe_ids: [...collection.recipe_ids, recipeId] }
            : collection
        )
      )
      toast.success('Zur Sammlung hinzugefügt.')
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hinzufügen fehlgeschlagen.'
      toast.error(message)
    }
  }

  async function handleCreateCollectionAndAdd() {
    const name = newCollectionName.trim()
    if (!name) {
      toast.error('Bitte gib einen Namen ein.')
      return
    }

    setIsCreating(true)
    try {
      const collection = await createCollectionAction(name)
      await addRecipeToCollectionAction(collection.id, recipeId)
      const withRecipe = collection.recipe_ids.includes(recipeId)
        ? collection
        : { ...collection, recipe_ids: [...collection.recipe_ids, recipeId] }
      onCollectionsChange([...collections, withRecipe])
      setNewCollectionName('')
      onOpenChange(false)
      toast.success('Sammlung erstellt und Rezept hinzugefügt.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erstellen fehlgeschlagen.'
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full p-0 nav-top:max-w-md">
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
          <DialogTitle>Zur Sammlung hinzufügen</DialogTitle>
          <DialogDescription>Wähle eine Sammlung oder erstelle eine neue.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            {collections.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Sammlungen. Erstelle unten deine erste.</p>
            ) : (
              collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => void handleAddToCollection(collection.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <span>{collection.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {collection.recipe_ids.length} Rezept{collection.recipe_ids.length === 1 ? '' : 'e'}
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-border/70 pt-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Neue Sammlung erstellen</div>
            <div className="flex gap-2">
              <Input
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder="Name der Sammlung"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleCreateCollectionAndAdd()
                  }
                }}
              />
              <Button
                onClick={() => void handleCreateCollectionAndAdd()}
                disabled={isCreating || !newCollectionName.trim()}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
