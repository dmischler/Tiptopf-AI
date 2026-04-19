'use client'

import Image from 'next/image'
import { ImageIcon, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Difficulty, ParsedRecipe, RecipeCategory } from '@/types'

const CATEGORIES: RecipeCategory[] = ['starter', 'main', 'dessert', 'side', 'breakfast', 'snack']
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  starter: 'Vorspeise',
  main: 'Hauptgericht',
  dessert: 'Dessert',
  side: 'Beilage',
  breakfast: 'Frühstück',
  snack: 'Snack',
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Schwer',
}

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
  isFindingImage?: boolean
  imageCreditName?: string | null
  imageCreditUrl?: string | null
  onChange: (next: EditableRecipePreview) => void
  onSave: () => Promise<void> | void
  onCancel: () => void
  onReplaceImage?: (file: File) => Promise<void> | void
  onFindImage?: () => Promise<void> | void
}

export function RecipePreview({
  parsedRecipe,
  value,
  disabled,
  isFindingImage,
  imageCreditName,
  imageCreditUrl,
  onChange,
  onSave,
  onCancel,
  onReplaceImage,
  onFindImage,
}: RecipePreviewProps) {
  const isRemoteImage = Boolean(value.imageUrl && /^https?:\/\//i.test(value.imageUrl))

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
    <div className="space-y-5">
      <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/30 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="preview-title">Titel</Label>
          <Input
            id="preview-title"
            value={value.title}
            disabled={disabled}
            className="bg-background/70"
            onChange={(event) => update({ title: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Kategorie</Label>
          <Select
            value={value.category}
            onValueChange={(category) => update({ category: category as RecipeCategory })}
          >
            <SelectTrigger className="w-full bg-background/70">
              <SelectValue>{CATEGORY_LABELS[value.category]}</SelectValue>
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
            onValueChange={(difficulty) => update({ difficulty: difficulty as Difficulty })}
          >
            <SelectTrigger className="w-full bg-background/70">
              <SelectValue>{DIFFICULTY_LABELS[value.difficulty]}</SelectValue>
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
          <Label htmlFor="preview-servings">Portionen</Label>
          <Input
            id="preview-servings"
            type="number"
            min={1}
            value={value.servings ?? ''}
            disabled={disabled}
            className="bg-background/70"
            onChange={(event) => {
              const parsed = Number(event.target.value)
              update({ servings: Number.isFinite(parsed) && parsed > 0 ? parsed : null })
            }}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-4">
        <Label>Bild</Label>
        {value.imageUrl ? (
          <div className="relative h-56 overflow-hidden rounded-xl border border-border/70 bg-background/70 sm:h-72">
            {isRemoteImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value.imageUrl} alt={value.title} className="h-full w-full object-cover" />
            ) : (
              <Image
                src={value.imageUrl}
                alt={value.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 90vw, 880px"
              />
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
            Noch kein Bild. Bild suchen oder manuell ersetzen.
          </div>
        )}

        {imageCreditName ? (
          <div className="text-xs text-muted-foreground">
            Foto von{' '}
            {imageCreditUrl ? (
              <a href={imageCreditUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {imageCreditName}
              </a>
            ) : (
              imageCreditName
            )}
          </div>
        ) : null}

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
            <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60">
              <Upload className="h-4 w-4" />
              Bild ersetzen
            </span>
          </label>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!onFindImage) {
                toast.error('Image search is not available right now.')
                return
              }

              void onFindImage()
            }}
            disabled={disabled || !onFindImage || isFindingImage}
          >
            {isFindingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            {isFindingImage ? 'Bild wird gesucht...' : 'Bild suchen'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Zutaten (schreibgeschützt)</Label>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
            <ul className="space-y-1">
              {parsedRecipe.ingredients.map((ingredient, index) => (
                <li key={`${ingredient}-${index}`}>• {ingredient}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Anleitung (schreibgeschützt)</Label>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border/70 bg-background/60 p-3 text-sm whitespace-pre-wrap">
            {parsedRecipe.instructions}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <span>
          Vorbereitung: {parsedRecipe.prep_time ?? '—'} min · Kochen: {parsedRecipe.cook_time ?? '—'} min · Quelle:{' '}
          {value.sourceType}
        </span>
        {value.sourceUrl && (
          <a href={value.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Quell-URL öffnen
          </a>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
          Verwerfen
        </Button>
        <Button type="button" onClick={() => void onSave()} disabled={disabled || !value.title.trim()}>
          In Bibliothek speichern
        </Button>
      </div>
    </div>
  )
}
