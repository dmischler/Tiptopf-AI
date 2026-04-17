'use client'

import Image from 'next/image'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Difficulty, ParsedRecipe, RecipeCategory } from '@/types'

const CATEGORIES: RecipeCategory[] = ['starter', 'main', 'dessert', 'side', 'breakfast', 'snack']
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export type EditableRecipePreview = {
  title: string
  category: RecipeCategory
  difficulty: Difficulty
  servings: number | null
  imageUrl: string | null
  sourceUrl: string | null
  sourceType: 'image' | 'url'
}

type RecipePreviewProps = {
  parsedRecipe: ParsedRecipe
  value: EditableRecipePreview
  disabled?: boolean
  onChange: (next: EditableRecipePreview) => void
  onSave: () => Promise<void> | void
  onCancel: () => void
  onReplaceImage?: (file: File) => Promise<void> | void
}

export function RecipePreview({
  parsedRecipe,
  value,
  disabled,
  onChange,
  onSave,
  onCancel,
  onReplaceImage,
}: RecipePreviewProps) {
  function update(next: Partial<EditableRecipePreview>) {
    onChange({
      ...value,
      ...next,
    })
  }

  async function handleReplaceImage(file: File | null) {
    if (!file || !onReplaceImage) return

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      toast.error('Only JPG, PNG, and WEBP images are supported.')
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Replacement image must be 5MB or smaller.')
      return
    }

    try {
      await onReplaceImage(file)
      toast.success('Image replaced.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to replace image.'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="preview-title">Title</Label>
          <Input
            id="preview-title"
            value={value.title}
            disabled={disabled}
            onChange={(event) => update({ title: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={value.category}
            onValueChange={(category) => update({ category: category as RecipeCategory })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select
            value={value.difficulty}
            onValueChange={(difficulty) => update({ difficulty: difficulty as Difficulty })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((difficulty) => (
                <SelectItem key={difficulty} value={difficulty}>
                  {difficulty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="preview-servings">Servings</Label>
          <Input
            id="preview-servings"
            type="number"
            min={1}
            value={value.servings ?? ''}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              update({ servings: Number.isFinite(parsed) && parsed > 0 ? parsed : null })
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Image</Label>
        {value.imageUrl ? (
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-border/70">
            <Image src={value.imageUrl} alt={value.title} fill className="object-cover" sizes="100vw" />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
            No persistent image yet. Phone uploads are discarded after extraction.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex">
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled || !onReplaceImage}
              onChange={(event) => {
                void handleReplaceImage(event.target.files?.[0] || null)
                event.currentTarget.value = ''
              }}
            />
            <span className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted/50">
              <Upload className="h-4 w-4" />
              Replace image
            </span>
          </label>

          <Button
            type="button"
            variant="outline"
            onClick={() => toast.info('Generate Image is coming soon.')}
            disabled={disabled}
          >
            Generate image
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Ingredients (read-only)</Label>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
            <ul className="space-y-1">
              {parsedRecipe.ingredients.map((ingredient, index) => (
                <li key={`${ingredient}-${index}`}>• {ingredient}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Instructions (read-only)</Label>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border/70 bg-background/50 p-3 text-sm whitespace-pre-wrap">
            {parsedRecipe.instructions}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Prep: {parsedRecipe.prep_time ?? '—'} min · Cook: {parsedRecipe.cook_time ?? '—'} min · Source:{' '}
          {value.sourceType}
        </span>
        {value.sourceUrl && (
          <a href={value.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Open source URL
          </a>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
          Discard
        </Button>
        <Button type="button" onClick={() => void onSave()} disabled={disabled || !value.title.trim()}>
          Save to library
        </Button>
      </div>
    </div>
  )
}
