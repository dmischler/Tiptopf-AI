'use client'

import Image from 'next/image'
import { ImageIcon, Loader2, Upload } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Difficulty, ParsedRecipe, RecipeCategory } from '@/types'
import { normalizeTags } from '@/lib/utils'

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
  tags: string[]
  ingredientsText: string
  instructionsText: string
}

type RecipePreviewProps = {
  parsedRecipe: ParsedRecipe
  value: EditableRecipePreview
  disabled?: boolean
  isFindingImage?: boolean
  imageCreditName?: string | null
  imageCreditUrl?: string | null
  allTags?: string[]
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
  allTags = [],
  onChange,
  onSave,
  onCancel,
  onReplaceImage,
  onFindImage,
}: RecipePreviewProps) {
  const isRemoteImage = Boolean(
    value.imageUrl && (/^https?:\/\//i.test(value.imageUrl) || value.imageUrl.startsWith('blob:'))
  )

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
      {parsedRecipe.untranslated ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          Nicht übersetzt — API-Key im Profil fehlt.
        </div>
      ) : null}

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
              <SelectValue>
                {(val) => (val ? CATEGORY_LABELS[val as RecipeCategory] : 'Kategorie')}
              </SelectValue>
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

      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-4">
        <TagsEditor
          tags={value.tags}
          allTags={allTags}
          disabled={disabled}
          onChange={(tags) => update({ tags })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-4">
          <Label>Zutaten (eine pro Zeile)</Label>
          <textarea
            value={value.ingredientsText}
            disabled={disabled}
            rows={6}
            className="w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y min-h-[100px] max-h-48"
            onChange={(event) => update({ ingredientsText: event.target.value })}
          />
        </div>

        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-4">
          <Label>Anleitung (ein Schritt pro Zeile)</Label>
          <textarea
            value={value.instructionsText}
            disabled={disabled}
            rows={8}
            className="w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y min-h-[120px] max-h-56"
            onChange={(event) => update({ instructionsText: event.target.value })}
          />
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

function TagsEditor({
  tags,
  allTags,
  disabled,
  onChange,
}: {
  tags: string[]
  allTags: string[]
  disabled?: boolean
  onChange: (tags: string[]) => void
}) {
  const [tagInput, setTagInput] = useState('')
  const normalizedInput = tagInput.trim().toLowerCase()
  const suggestions =
    normalizedInput.length === 0
      ? []
      : allTags
          .filter((tag) => tag.startsWith(normalizedInput))
          .filter((tag) => !tags.includes(tag))
          .slice(0, 6)

  function addTag(raw: string) {
    const normalized = normalizeTags([raw])[0]
    if (normalized && !tags.includes(normalized)) {
      onChange([...tags, normalized])
    }
  }

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="ml-0.5 text-zinc-500 hover:text-zinc-200"
              disabled={disabled}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={tagInput}
            disabled={disabled}
            placeholder="Tag eingeben..."
            className="bg-background/70"
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                if (normalizedInput) {
                  addTag(normalizedInput)
                  setTagInput('')
                }
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !normalizedInput}
            onClick={() => {
              addTag(normalizedInput)
              setTagInput('')
            }}
          >
            Hinzufügen
          </Button>
        </div>
        {suggestions.length > 0 ? (
          <div className="absolute top-[calc(100%+0.4rem)] left-0 z-20 w-full rounded-lg border border-border/70 bg-popover p-1 shadow-lg">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => {
                  addTag(tag)
                  setTagInput('')
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
