'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { uploadRecipeImage } from '@/app/actions/add-recipe'
import { editRecipe } from '@/app/actions/recipe'
import { deleteRecipeWithUndo } from '@/components/library/recipe-navigation'
import { DeleteRecipeDialog } from '@/components/recipe/delete-recipe-dialog'
import { ImagePicker } from '@/components/recipe/image-picker'
import {
  parseRecipeFieldsForSave,
  RecipeFields,
  type RecipeFieldsValue,
} from '@/components/recipe/recipe-fields'
import { toInstructionSteps } from '@/components/recipe/recipe-instructions'
import { Button } from '@/components/ui/button'
import type { Recipe } from '@/types'

type RecipeEditFormProps = {
  recipe: Recipe
  allTags?: string[]
}

function toDraft(recipe: Recipe): RecipeFieldsValue {
  return {
    title: recipe.title,
    category: recipe.category,
    difficulty: recipe.difficulty,
    prepTime: recipe.prep_time > 0 ? String(recipe.prep_time) : '',
    cookTime: recipe.cook_time > 0 ? String(recipe.cook_time) : '',
    servings: recipe.servings > 0 ? String(recipe.servings) : '',
    ingredientsText: recipe.ingredients.join('\n'),
    instructionsText: toInstructionSteps(recipe.instructions).join('\n'),
    notes: recipe.notes ?? '',
    tags: [...recipe.tags],
    imageUrl: recipe.image_url,
  }
}

export function RecipeEditForm({ recipe: initialRecipe, allTags = [] }: RecipeEditFormProps) {
  const router = useRouter()
  const [currentRecipe, setCurrentRecipe] = useState(initialRecipe)
  const [draft, setDraft] = useState<RecipeFieldsValue>(() => toDraft(initialRecipe))
  const [isSaving, setIsSaving] = useState(false)
  const [replacementImageFile, setReplacementImageFile] = useState<File | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const viewHref = `/library/${currentRecipe.id}`

  async function handleSaveEdit() {
    let parsed: ReturnType<typeof parseRecipeFieldsForSave>
    try {
      parsed = parseRecipeFieldsForSave(draft)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ungültiger Zahlenwert.'
      toast.error(message)
      return
    }

    setIsSaving(true)
    try {
      await editRecipe(currentRecipe.id, {
        title: parsed.title,
        ingredients: parsed.ingredients,
        instructions: parsed.instructions,
        prep_time: parsed.prepTime,
        cook_time: parsed.cookTime,
        servings: parsed.servings,
        category: parsed.category,
        difficulty: parsed.difficulty,
        tags: parsed.tags,
        notes: parsed.notes,
      })

      if (replacementImageFile) {
        const imageFormData = new FormData()
        imageFormData.append('recipeId', currentRecipe.id)
        imageFormData.append('image', replacementImageFile)
        await uploadRecipeImage(imageFormData)
      }

      toast.success('Rezept aktualisiert.')
      router.push(viewHref)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Aktualisieren fehlgeschlagen.'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true)
    try {
      await deleteRecipeWithUndo(currentRecipe, (href) => {
        router.push(href)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Löschen fehlgeschlagen.'
      toast.error(message)
      setIsDeleting(false)
      setConfirmDeleteOpen(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pt-8 pb-[max(6rem,env(safe-area-inset-bottom))] standalone:pt-4 nav-top:pb-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => router.push(viewHref)}
            disabled={isSaving}
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Rezept bearbeiten</h1>
            <p className="text-sm text-muted-foreground">Rezeptdetails aktualisieren und Änderungen speichern.</p>
          </div>
        </div>

        <div className="space-y-4">
          <ImagePicker
            recipeId={currentRecipe.id}
            title={draft.title || currentRecipe.title}
            category={draft.category}
            imageUrl={draft.imageUrl}
            imageVersion={currentRecipe.updated_at}
            disabled={isSaving}
            onImageUrlChange={(url) => {
              setDraft((current) => ({ ...current, imageUrl: url }))
              if (url && url.startsWith('/api/images/')) {
                setCurrentRecipe((current) => ({
                  ...current,
                  image_url: url,
                  updated_at: new Date().toISOString(),
                }))
              }
            }}
            onFileChange={setReplacementImageFile}
          />

          <RecipeFields
            value={draft}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            allTags={allTags}
            disabled={isSaving}
          />

          <div className="sticky z-20 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-background/95 px-4 py-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] pb-[max(0.75rem,env(safe-area-inset-bottom))] nav-top:bottom-0">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={isSaving || isDeleting}
            >
              <Trash2 className="h-4 w-4" />
              Rezept löschen
            </Button>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => router.push(viewHref)} disabled={isSaving}>
                Abbrechen
              </Button>
              <Button type="button" className="h-11" onClick={() => void handleSaveEdit()} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Speichern
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DeleteRecipeDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={() => void handleConfirmDelete()}
        isDeleting={isDeleting}
      />
    </main>
  )
}
