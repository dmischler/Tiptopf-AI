'use client'

import { TagsEditor } from '@/components/recipe/tags-editor'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATEGORIES, CATEGORY_LABELS, DIFFICULTIES, DIFFICULTY_LABELS } from '@/lib/recipe-meta'
import type { Difficulty, RecipeCategory } from '@/types'

export type RecipeFieldsValue = {
  title: string
  category: RecipeCategory
  difficulty: Difficulty
  prepTime: string | number | null
  cookTime: string | number | null
  servings: string | number | null
  ingredientsText: string
  instructionsText: string
  notes: string
  tags: string[]
  imageUrl: string | null
}

export type RecipeFieldsProps = {
  value: RecipeFieldsValue
  onChange: (patch: Partial<RecipeFieldsValue>) => void
  allTags: string[]
  disabled?: boolean
  /** hide notes on add-preview if we want; default show */
  showNotes?: boolean
}

export function toNonEmptyLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function parseOptionalInt(value: string | number | null | undefined, min: number, field: string) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < min) {
      throw new Error(`${field} muss eine ganze Zahl ${min === 0 ? 'ab 0' : `ab ${min}`} sein.`)
    }
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${field} muss eine ganze Zahl ${min === 0 ? 'ab 0' : `ab ${min}`} sein.`)
  }

  return parsed
}

export function parseRecipeFieldsForSave(value: RecipeFieldsValue) {
  const title = value.title.trim()
  const ingredients = toNonEmptyLines(value.ingredientsText)
  const instructions = toNonEmptyLines(value.instructionsText).join('\n')

  if (!title) {
    throw new Error('Titel ist erforderlich.')
  }

  if (ingredients.length === 0) {
    throw new Error('Mindestens eine Zutat ist erforderlich.')
  }

  if (!instructions) {
    throw new Error('Die Anleitung ist erforderlich.')
  }

  return {
    title,
    ingredients,
    instructions,
    prepTime: parseOptionalInt(value.prepTime, 0, 'Vorbereitungszeit'),
    cookTime: parseOptionalInt(value.cookTime, 0, 'Kochzeit'),
    servings: parseOptionalInt(value.servings, 1, 'Portionen'),
    category: value.category,
    difficulty: value.difficulty,
    tags: value.tags,
    notes: value.notes.trim(),
    imageUrl: value.imageUrl,
  }
}

function toInputValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

export function RecipeFields({
  value,
  onChange,
  allTags,
  disabled,
  showNotes = true,
}: RecipeFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/30 p-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="recipe-field-title">Titel</Label>
          <Input
            id="recipe-field-title"
            value={value.title}
            disabled={disabled}
            className="bg-background/70"
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Kategorie</Label>
          <Select
            value={value.category}
            onValueChange={(category) => onChange({ category: category as RecipeCategory })}
            disabled={disabled}
          >
            <SelectTrigger className="w-full bg-background/70">
              <SelectValue>{(val) => (val ? CATEGORY_LABELS[val as RecipeCategory] : 'Kategorie')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Schwierigkeit</Label>
          <Select
            value={value.difficulty}
            onValueChange={(difficulty) => onChange({ difficulty: difficulty as Difficulty })}
            disabled={disabled}
          >
            <SelectTrigger className="w-full bg-background/70">
              <SelectValue>
                {(val) => (val ? DIFFICULTY_LABELS[val as Difficulty] : 'Schwierigkeit')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((difficulty) => (
                <SelectItem key={difficulty} value={difficulty}>
                  {DIFFICULTY_LABELS[difficulty]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipe-field-prep">Vorbereitungszeit (Minuten)</Label>
          <Input
            id="recipe-field-prep"
            type="number"
            min={0}
            value={toInputValue(value.prepTime)}
            disabled={disabled}
            className="bg-background/70"
            onChange={(event) => onChange({ prepTime: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipe-field-cook">Kochzeit (Minuten)</Label>
          <Input
            id="recipe-field-cook"
            type="number"
            min={0}
            value={toInputValue(value.cookTime)}
            disabled={disabled}
            className="bg-background/70"
            onChange={(event) => onChange({ cookTime: event.target.value })}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="recipe-field-servings">Portionen</Label>
          <Input
            id="recipe-field-servings"
            type="number"
            min={1}
            value={toInputValue(value.servings)}
            disabled={disabled}
            className="bg-background/70"
            onChange={(event) => onChange({ servings: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-4">
        <TagsEditor
          tags={value.tags}
          allTags={allTags}
          disabled={disabled}
          onChange={(tags) => onChange({ tags })}
        />
      </div>

      <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-4">
        <Label htmlFor="recipe-field-ingredients">Zutaten (eine pro Zeile)</Label>
        <textarea
          id="recipe-field-ingredients"
          value={value.ingredientsText}
          disabled={disabled}
          rows={8}
          className="min-h-36 w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={(event) => onChange({ ingredientsText: event.target.value })}
        />
      </div>

      <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-4">
        <Label htmlFor="recipe-field-instructions">Anleitung (ein Schritt pro Zeile)</Label>
        <textarea
          id="recipe-field-instructions"
          value={value.instructionsText}
          disabled={disabled}
          rows={10}
          className="min-h-40 w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={(event) => onChange({ instructionsText: event.target.value })}
        />
      </div>

      {showNotes ? (
        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="recipe-field-notes">Anmerkungen (optional)</Label>
            <span
              className={`text-xs tabular-nums ${value.notes.length > 1800 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}
            >
              {value.notes.length} / 2000
            </span>
          </div>
          <textarea
            id="recipe-field-notes"
            value={value.notes}
            disabled={disabled}
            rows={6}
            maxLength={2000}
            placeholder="Persönliche Notizen, Variationen, Tipps…"
            className="min-h-28 w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            onChange={(event) => onChange({ notes: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Unterstützt **fett**, - Listen und 1. nummerierte Listen.
          </p>
        </div>
      ) : null}
    </div>
  )
}
