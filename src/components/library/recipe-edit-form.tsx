'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { uploadRecipeImage } from '@/app/actions/add-recipe'
import {
  applyRecipeImageCandidateAction,
  searchRecipeImageCandidatesAction,
} from '@/app/actions/extract-recipe'
import { editRecipe } from '@/app/actions/recipe'
import { ImageSelectionModal } from '@/components/add-recipe/image-selection-modal'
import { deleteRecipeWithUndo } from '@/components/library/recipe-navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { RecipeImageCandidate } from '@/lib/ai/image-types'
import { toRecipeImageSrc } from '@/lib/recipe-image'
import type { Difficulty, Recipe, RecipeCategory } from '@/types'

type RecipeEditFormProps = {
  recipe: Recipe
  allTags?: string[]
}

type RecipeDraft = {
  title: string
  category: RecipeCategory
  difficulty: Difficulty
  prepTime: string
  cookTime: string
  servings: string
  ingredientsText: string
  instructionsText: string
  notes: string
  imageUrl: string | null
  tags: string[]
  tagInput: string
}

type ImageMeta = {
  creditName?: string
  creditUrl?: string
}

const CATEGORIES: RecipeCategory[] = ['starter', 'main', 'dessert', 'side', 'breakfast', 'snack']
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

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

function toInstructionSteps(instructions: string) {
  const lines = instructions
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0 && instructions.trim()) {
    return [instructions.trim()]
  }

  return lines.map((line) => line.replace(/^\d+[.)]\s*/, ''))
}

function toNonEmptyLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function toDraft(recipe: Recipe): RecipeDraft {
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
    imageUrl: recipe.image_url,
    tags: [...recipe.tags],
    tagInput: '',
  }
}

function parseOptionalInt(value: string, min: number, field: string) {
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

export function RecipeEditForm({ recipe: initialRecipe, allTags = [] }: RecipeEditFormProps) {
  const router = useRouter()
  const [currentRecipe, setCurrentRecipe] = useState(initialRecipe)
  const [draft, setDraft] = useState<RecipeDraft>(() => toDraft(initialRecipe))
  const [isSaving, setIsSaving] = useState(false)
  const [replacementImageFile, setReplacementImageFile] = useState<File | null>(null)
  const [replacementImagePreviewUrl, setReplacementImagePreviewUrl] = useState<string | null>(null)
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null)
  const [isFindingImage, setIsFindingImage] = useState(false)
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false)
  const [imageCandidates, setImageCandidates] = useState<RecipeImageCandidate[]>([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const viewHref = `/library/${currentRecipe.id}`

  useEffect(() => {
    if (!replacementImagePreviewUrl) {
      return
    }

    return () => {
      URL.revokeObjectURL(replacementImagePreviewUrl)
    }
  }, [replacementImagePreviewUrl])

  const currentImageUrl = toRecipeImageSrc({
    image_url: replacementImagePreviewUrl ?? draft.imageUrl,
    updated_at: currentRecipe.updated_at,
  })
  const normalizedTagInput = draft.tagInput.trim().toLowerCase()
  const tagSuggestions =
    normalizedTagInput.length === 0
      ? []
      : allTags
          .filter((tag) => tag.startsWith(normalizedTagInput))
          .filter((tag) => !draft.tags.includes(tag))
          .slice(0, 6)

  function applyResolvedImage(imageUrl: string, meta: ImageMeta | null = null) {
    if (replacementImagePreviewUrl) {
      URL.revokeObjectURL(replacementImagePreviewUrl)
      setReplacementImagePreviewUrl(null)
    }

    setReplacementImageFile(null)
    setImageMeta(meta)
    setDraft((current) => ({
      ...current,
      imageUrl,
    }))
  }

  async function loadImageCandidates() {
    setIsLoadingCandidates(true)
    try {
      const candidates = await searchRecipeImageCandidatesAction(
        draft.title.trim() || currentRecipe.title,
        draft.category
      )
      setImageCandidates(candidates)
      return candidates
    } catch {
      setImageCandidates([])
      toast.error('Bildsuche gerade nicht möglich.')
      return [] as RecipeImageCandidate[]
    } finally {
      setIsLoadingCandidates(false)
    }
  }

  async function handleFindImage() {
    setIsFindingImage(true)
    try {
      const candidates = await loadImageCandidates()
      setIsSelectionModalOpen(true)
      if (!currentImageUrl && candidates.length === 0) {
        toast.info('Keine Treffer gefunden. Du kannst im Picker ein KI-Bild erzeugen.')
      }
    } finally {
      setIsFindingImage(false)
    }
  }

  async function handleSelectImageCandidate(candidate: RecipeImageCandidate) {
    try {
      const persistedUrl = await applyRecipeImageCandidateAction(currentRecipe.id, candidate.url)
      applyResolvedImage(persistedUrl, {
        creditName: candidate.creditName,
        creditUrl: candidate.creditUrl,
      })
      setCurrentRecipe((current) => ({
        ...current,
        image_url: persistedUrl,
        updated_at: new Date().toISOString(),
      }))
      setIsSelectionModalOpen(false)
      toast.success('Bild aktualisiert.')
    } catch {
      toast.error('Bild konnte nicht übernommen werden.')
    }
  }

  async function handleReplaceImage(file: File | null) {
    if (!file) {
      return
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      toast.error('Nur JPG, PNG und WEBP werden unterstützt.')
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Das Bild darf höchstens 5 MB groß sein.')
      return
    }

    if (replacementImagePreviewUrl) {
      URL.revokeObjectURL(replacementImagePreviewUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setReplacementImageFile(file)
    setReplacementImagePreviewUrl(objectUrl)
    setImageMeta(null)
    setDraft((current) => ({
      ...current,
      imageUrl: objectUrl,
    }))
    toast.success('Bild ersetzt.')
  }

  async function handleSaveEdit() {
    const title = draft.title.trim()
    const ingredients = toNonEmptyLines(draft.ingredientsText)
    const instructionsLines = toNonEmptyLines(draft.instructionsText)
    const instructions = instructionsLines.join('\n')

    if (!title) {
      toast.error('Titel ist erforderlich.')
      return
    }

    if (ingredients.length === 0) {
      toast.error('Mindestens eine Zutat ist erforderlich.')
      return
    }

    if (!instructions) {
      toast.error('Die Anleitung ist erforderlich.')
      return
    }

    let prepTime: number | null
    let cookTime: number | null
    let servings: number | null

    try {
      prepTime = parseOptionalInt(draft.prepTime, 0, 'Vorbereitungszeit')
      cookTime = parseOptionalInt(draft.cookTime, 0, 'Kochzeit')
      servings = parseOptionalInt(draft.servings, 1, 'Portionen')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ungültiger Zahlenwert.'
      toast.error(message)
      return
    }

    setIsSaving(true)
    try {
      await editRecipe(currentRecipe.id, {
        title,
        ingredients,
        instructions,
        prep_time: prepTime,
        cook_time: cookTime,
        servings,
        category: draft.category,
        difficulty: draft.difficulty,
        tags: draft.tags,
        notes: draft.notes,
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
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))] md:pb-8 sm:px-6 lg:px-8">
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
          <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/30 p-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="recipe-edit-title">Titel</Label>
              <Input
                id="recipe-edit-title"
                value={draft.title}
                disabled={isSaving}
                className="bg-background/70"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select
                value={draft.category}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    category: value as RecipeCategory,
                  }))
                }
                disabled={isSaving}
              >
                <SelectTrigger className="w-full bg-background/70">
                  <SelectValue>{(val) => (val ? CATEGORY_LABELS[val as RecipeCategory] : 'Kategorie')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Schwierigkeit</Label>
              <Select
                value={draft.difficulty}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    difficulty: value as Difficulty,
                  }))
                }
                disabled={isSaving}
              >
                <SelectTrigger className="w-full bg-background/70">
                  <SelectValue>
                    {(val) => (val ? DIFFICULTY_LABELS[val as Difficulty] : 'Schwierigkeit')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((diff) => (
                    <SelectItem key={diff} value={diff}>
                      {DIFFICULTY_LABELS[diff]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipe-edit-prep">Vorbereitungszeit (Minuten)</Label>
              <Input
                id="recipe-edit-prep"
                type="number"
                min={0}
                value={draft.prepTime}
                disabled={isSaving}
                className="bg-background/70"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    prepTime: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipe-edit-cook">Kochzeit (Minuten)</Label>
              <Input
                id="recipe-edit-cook"
                type="number"
                min={0}
                value={draft.cookTime}
                disabled={isSaving}
                className="bg-background/70"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    cookTime: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="recipe-edit-servings">Portionen</Label>
              <Input
                id="recipe-edit-servings"
                type="number"
                min={1}
                value={draft.servings}
                disabled={isSaving}
                className="bg-background/70"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    servings: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-4">
            <Label>Bild</Label>
            {currentImageUrl ? (
              <div className="relative h-56 overflow-hidden rounded-xl border border-border/70 bg-background/70 sm:h-72">
                {currentImageUrl.startsWith('blob:') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentImageUrl}
                    alt={draft.title || currentRecipe.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={currentImageUrl}
                    alt={draft.title || currentRecipe.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 90vw, 768px"
                  />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
                Noch kein Bild. Bild suchen oder manuell ersetzen.
              </div>
            )}

            {imageMeta?.creditName ? (
              <div className="text-xs text-muted-foreground">
                Foto von{' '}
                {imageMeta.creditUrl ? (
                  <a
                    href={imageMeta.creditUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {imageMeta.creditName}
                  </a>
                ) : (
                  imageMeta.creditName
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex">
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isSaving}
                  onChange={(event) => {
                    void handleReplaceImage(event.target.files?.[0] || null)
                    event.currentTarget.value = ''
                  }}
                />
                <span className="inline-flex h-10 min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-border bg-background/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60">
                  <Upload className="h-4 w-4" />
                  Bild ersetzen
                </span>
              </label>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void handleFindImage()
                }}
                disabled={isSaving || isFindingImage}
              >
                {isFindingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {isFindingImage ? 'Bild wird gesucht...' : 'Bild suchen'}
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-4">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {draft.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        tags: current.tags.filter((t) => t !== tag),
                      }))
                    }
                    className="ml-0.5 text-zinc-500 hover:text-zinc-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <div className="flex gap-2">
                <Input
                  value={draft.tagInput}
                  disabled={isSaving}
                  placeholder="Tag eingeben..."
                  className="bg-background/70"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, tagInput: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault()
                      const raw = draft.tagInput.trim().toLowerCase()
                      if (raw && !draft.tags.includes(raw)) {
                        setDraft((current) => ({
                          ...current,
                          tags: [...current.tags, raw],
                          tagInput: '',
                        }))
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving || !draft.tagInput.trim()}
                  onClick={() => {
                    const raw = draft.tagInput.trim().toLowerCase()
                    if (raw && !draft.tags.includes(raw)) {
                      setDraft((current) => ({
                        ...current,
                        tags: [...current.tags, raw],
                        tagInput: '',
                      }))
                    }
                  }}
                >
                  Hinzufügen
                </Button>
              </div>
              {tagSuggestions.length > 0 ? (
                <div className="absolute top-[calc(100%+0.4rem)] left-0 z-20 w-full rounded-lg border border-border/70 bg-popover p-1 shadow-lg">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          tags: [...current.tags, tag],
                          tagInput: '',
                        }))
                      }
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-4">
            <Label htmlFor="recipe-edit-ingredients">Zutaten (eine pro Zeile)</Label>
            <textarea
              id="recipe-edit-ingredients"
              value={draft.ingredientsText}
              disabled={isSaving}
              rows={8}
              className="min-h-36 w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  ingredientsText: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-4">
            <Label htmlFor="recipe-edit-instructions">Anleitung (ein Schritt pro Zeile)</Label>
            <textarea
              id="recipe-edit-instructions"
              value={draft.instructionsText}
              disabled={isSaving}
              rows={10}
              className="min-h-40 w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  instructionsText: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="recipe-edit-notes">Anmerkungen (optional)</Label>
              <span
                className={`text-xs tabular-nums ${draft.notes.length > 1800 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}
              >
                {draft.notes.length} / 2000
              </span>
            </div>
            <textarea
              id="recipe-edit-notes"
              value={draft.notes}
              disabled={isSaving}
              rows={6}
              maxLength={2000}
              placeholder="Persönliche Notizen, Variationen, Tipps…"
              className="min-h-28 w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Unterstützt **fett**, - Listen und 1. nummerierte Listen.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
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
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(viewHref)}
                disabled={isSaving}
              >
                Abbrechen
              </Button>
              <Button type="button" onClick={() => void handleSaveEdit()} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Speichern
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ImageSelectionModal
        open={isSelectionModalOpen}
        loading={isLoadingCandidates}
        title={draft.title || currentRecipe.title}
        candidates={imageCandidates}
        onOpenChange={setIsSelectionModalOpen}
        onSelectCandidate={(candidate) => {
          void handleSelectImageCandidate(candidate)
        }}
        onRefreshSearch={() => {
          void loadImageCandidates()
        }}
      />

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="w-full max-w-md p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
            <DialogTitle>Rezept löschen?</DialogTitle>
            <DialogDescription>
              Rezept in den Papierkorb. Du kannst es kurz rückgängig machen.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 px-5 py-4">
            <Button type="button" variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={isDeleting}>
              Abbrechen
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleConfirmDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
