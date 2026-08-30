'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { ImagePicker } from '@/components/recipe/image-picker'
import {
  parseRecipeFieldsForSave,
  RecipeFields,
  type RecipeFieldsValue,
} from '@/components/recipe/recipe-fields'
import { Button } from '@/components/ui/button'
import type { Difficulty, RecipeCategory } from '@/types'

export type ManualRecipeInput = {
  title: string
  ingredients: string[]
  instructions: string
  prepTime: number
  cookTime: number
  servings: number
  category: RecipeCategory
  difficulty: Difficulty
  tags: string[]
  imageUrl: string | null
  notes?: string
}

type ManualFormProps = {
  onSave: (recipe: ManualRecipeInput, imageFile: File | null) => Promise<void>
  onCancel: () => void
  isSaving: boolean
  allTags?: string[]
}

const EMPTY_FIELDS: RecipeFieldsValue = {
  title: '',
  category: 'main',
  difficulty: 'easy',
  prepTime: '',
  cookTime: '',
  servings: '',
  ingredientsText: '',
  instructionsText: '',
  notes: '',
  tags: [],
  imageUrl: null,
}

export function ManualForm({ onSave, onCancel, isSaving, allTags = [] }: ManualFormProps) {
  const [value, setValue] = useState<RecipeFieldsValue>(EMPTY_FIELDS)
  const [imageFile, setImageFile] = useState<File | null>(null)

  async function handleSubmit() {
    let parsed: ReturnType<typeof parseRecipeFieldsForSave>
    try {
      parsed = parseRecipeFieldsForSave(value)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ungültiger Zahlenwert.'
      toast.error(message)
      return
    }

    const recipe: ManualRecipeInput = {
      title: parsed.title,
      ingredients: parsed.ingredients,
      instructions: parsed.instructions,
      prepTime: parsed.prepTime ?? 0,
      cookTime: parsed.cookTime ?? 0,
      servings: parsed.servings ?? 1,
      category: parsed.category,
      difficulty: parsed.difficulty,
      tags: parsed.tags,
      imageUrl: imageFile ? null : parsed.imageUrl,
      notes: parsed.notes,
    }

    await onSave(recipe, imageFile)
  }

  return (
    <div className="space-y-5">
      <ImagePicker
        title={value.title}
        category={value.category}
        imageUrl={value.imageUrl}
        disabled={isSaving}
        onImageUrlChange={(imageUrl) => setValue((current) => ({ ...current, imageUrl }))}
        onFileChange={setImageFile}
      />

      <RecipeFields
        value={value}
        onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
        allTags={allTags}
        disabled={isSaving}
        showNotes={false}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Abbrechen
        </Button>
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSaving || !value.title.trim() || !value.ingredientsText.trim() || !value.instructionsText.trim()}
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Speichern
        </Button>
      </div>
    </div>
  )
}
