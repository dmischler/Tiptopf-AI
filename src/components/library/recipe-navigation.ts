'use client'

import { toast } from 'sonner'

import {
  deleteRecipeAction,
  purgeTrashedRecipeImageAction,
  restoreRecipe,
} from '@/app/actions/recipe'
import type { Recipe } from '@/types'

let pendingImagePurge: ReturnType<typeof setTimeout> | null = null

export async function deleteRecipeWithUndo(recipe: Recipe, push: (href: string) => void) {
  await deleteRecipeAction(recipe.id)

  if (pendingImagePurge) {
    clearTimeout(pendingImagePurge)
  }

  pendingImagePurge = setTimeout(() => {
    pendingImagePurge = null
    void purgeTrashedRecipeImageAction(recipe.id).catch(() => undefined)
  }, 30_000)

  toast.success('Rezept gelöscht', {
    duration: 30_000,
    action: {
      label: 'Rückgängig',
      onClick: () => {
        if (pendingImagePurge) {
          clearTimeout(pendingImagePurge)
          pendingImagePurge = null
        }

        void restoreRecipe({
          id: recipe.id,
          title: recipe.title,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_time,
          servings: recipe.servings,
          category: recipe.category,
          difficulty: recipe.difficulty,
          rating: recipe.rating,
          is_favorite: recipe.is_favorite,
          image_url: recipe.image_url,
          source_url: recipe.source_url,
          source_type: recipe.source_type,
          tags: recipe.tags,
          notes: recipe.notes ?? '',
          created_at: recipe.created_at,
          updated_at: recipe.updated_at,
        })
          .then(() => {
            push(`/library/${recipe.id}`)
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : 'Wiederherstellen fehlgeschlagen.'
            toast.error(message)
          })
      },
    },
  })

  push('/library')
}
