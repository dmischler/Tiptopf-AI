'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import {
  Clock,
  ExternalLink,
  FolderPlus,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Timer,
  Trash2,
  Upload,
  UtensilsCrossed,
} from 'lucide-react'
import { toast } from 'sonner'

import { uploadRecipeImage } from '@/app/actions/add-recipe'
import { addRecipeToCollectionAction, createCollectionAction } from '@/app/actions/collections'
import {
  applyRecipeImageCandidateAction,
  searchRecipeImageCandidatesAction,
} from '@/app/actions/extract-recipe'
import { editRecipe, setRecipeImage } from '@/app/actions/recipe'
import { ImageSelectionModal } from '@/components/add-recipe/image-selection-modal'
import { FavoriteButton } from '@/components/interactions/favorite-button'
import { Rating } from '@/components/interactions/rating'
import { Badge } from '@/components/ui/badge'
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
import type { Collection, Difficulty, Recipe, RecipeCategory } from '@/types'

type RecipeDetailProps = {
  recipe: Recipe | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onFavoriteChange?: (value: boolean) => void
  onRatingChange?: (value: number | null) => void
  onRecipeUpdated?: (recipe: Recipe) => void
  onRecipeDeleteRequested?: (recipe: Recipe) => void
  collections?: Collection[]
}

type EditMode = 'view' | 'edit'

type RecipeDraft = {
  title: string
  category: RecipeCategory
  difficulty: Difficulty
  prepTime: string
  cookTime: string
  servings: string
  ingredientsText: string
  instructionsText: string
  imageUrl: string | null
  tags: string[]
  tagInput: string
}

type ImageMeta = {
  creditName?: string
  creditUrl?: string
}

const CATEGORY_CLASS: Record<Recipe['category'], string> = {
  starter: 'bg-cyan-500/15 text-cyan-300',
  main: 'bg-amber-500/20 text-amber-300',
  dessert: 'bg-rose-500/15 text-rose-300',
  side: 'bg-emerald-500/15 text-emerald-300',
  breakfast: 'bg-yellow-500/20 text-yellow-300',
  snack: 'bg-orange-500/20 text-orange-300',
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

function formatCategoryLabel(category: Recipe['category']) {
  return CATEGORY_LABELS[category]
}

function formatDifficultyLabel(difficulty: Recipe['difficulty']) {
  return DIFFICULTY_LABELS[difficulty]
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
    throw new Error(`${field} must be an integer ${min === 0 ? '0 or higher' : `${min} or higher`}.`)
  }

  return parsed
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-3">
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="inline-flex items-center gap-2 text-sm font-medium">
        {icon}
        {value}
      </div>
    </div>
  )
}

export function RecipeDetail({
  recipe,
  open,
  onOpenChange,
  onFavoriteChange,
  onRatingChange,
  onRecipeUpdated,
  onRecipeDeleteRequested,
  collections = [],
}: RecipeDetailProps) {
  const [mode, setMode] = useState<EditMode>('view')
  const [draft, setDraft] = useState<RecipeDraft | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [replacementImageFile, setReplacementImageFile] = useState<File | null>(null)
  const [replacementImagePreviewUrl, setReplacementImagePreviewUrl] = useState<string | null>(null)
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null)
  const [isFindingImage, setIsFindingImage] = useState(false)
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false)
  const [imageCandidates, setImageCandidates] = useState<RecipeImageCandidate[]>([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false)
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')

  useEffect(() => {
    if (!replacementImagePreviewUrl) {
      return
    }

    return () => {
      URL.revokeObjectURL(replacementImagePreviewUrl)
    }
  }, [replacementImagePreviewUrl])

  useEffect(() => {
    if (!recipe || !open) {
      return
    }

    setMode('view')
    setDraft(toDraft(recipe))
    setReplacementImageFile(null)
    setReplacementImagePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current)
      }

      return null
    })
    setImageMeta(null)
    setIsSelectionModalOpen(false)
    setImageCandidates([])
    setConfirmDeleteOpen(false)
  }, [open, recipe])

  if (!recipe || !draft) {
    return null
  }

  const currentRecipe = recipe
  const instructionSteps = toInstructionSteps(currentRecipe.instructions)
  const totalTime = currentRecipe.prep_time + currentRecipe.cook_time
  const currentImageUrl = replacementImagePreviewUrl ?? draft.imageUrl

  function resetDraftFromRecipe() {
    setDraft(toDraft(currentRecipe))
    setReplacementImageFile(null)
    if (replacementImagePreviewUrl) {
      URL.revokeObjectURL(replacementImagePreviewUrl)
    }
    setReplacementImagePreviewUrl(null)
    setImageMeta(null)
    setIsSelectionModalOpen(false)
    setImageCandidates([])
  }

  function applyResolvedImage(imageUrl: string, meta: ImageMeta | null = null) {
    if (replacementImagePreviewUrl) {
      URL.revokeObjectURL(replacementImagePreviewUrl)
      setReplacementImagePreviewUrl(null)
    }

    setReplacementImageFile(null)
    setImageMeta(meta)
    setDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        imageUrl,
      }
    })
  }

  async function loadImageCandidates() {
    const currentDraft = draft
    if (!currentDraft) {
      return [] as RecipeImageCandidate[]
    }

    setIsLoadingCandidates(true)
    try {
      const candidates = await searchRecipeImageCandidatesAction(
        currentDraft.title.trim() || currentRecipe.title,
        currentDraft.category
      )
      setImageCandidates(candidates)
      return candidates
    } catch {
      setImageCandidates([])
      toast.error('Failed to search image providers right now.')
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
        toast.info('No external matches yet. You can generate an AI image in the picker.')
      }
    } finally {
      setIsFindingImage(false)
    }
  }

  async function handleSelectImageCandidate(candidate: RecipeImageCandidate) {
    try {
      const persistedUrl = await applyRecipeImageCandidateAction(candidate.url)
      applyResolvedImage(persistedUrl, {
        creditName: candidate.creditName,
        creditUrl: candidate.creditUrl,
      })
      setIsSelectionModalOpen(false)
      toast.success('Image updated.')
    } catch {
      toast.error('Failed to apply selected image.')
    }
  }

  async function handleReplaceImage(file: File | null) {
    if (!file) {
      return
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      toast.error('Only JPG, PNG, and WEBP images are supported.')
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Replacement image must be 5MB or smaller.')
      return
    }

    if (replacementImagePreviewUrl) {
      URL.revokeObjectURL(replacementImagePreviewUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setReplacementImageFile(file)
    setReplacementImagePreviewUrl(objectUrl)
    setImageMeta(null)
    setDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        imageUrl: objectUrl,
      }
    })
    toast.success('Image replaced.')
  }

  async function handleSaveEdit() {
    const currentDraft = draft
    if (!currentDraft) {
      return
    }

    const title = currentDraft.title.trim()
    const ingredients = toNonEmptyLines(currentDraft.ingredientsText)
    const instructionsLines = toNonEmptyLines(currentDraft.instructionsText)
    const instructions = instructionsLines.join('\n')

    if (!title) {
      toast.error('Title is required.')
      return
    }

    if (ingredients.length === 0) {
      toast.error('At least one ingredient is required.')
      return
    }

    if (!instructions) {
      toast.error('Instructions are required.')
      return
    }

    let prepTime: number | null
    let cookTime: number | null
    let servings: number | null

    try {
      prepTime = parseOptionalInt(currentDraft.prepTime, 0, 'Prep time')
      cookTime = parseOptionalInt(currentDraft.cookTime, 0, 'Cook time')
      servings = parseOptionalInt(currentDraft.servings, 1, 'Servings')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid numeric value.'
      toast.error(message)
      return
    }

    setIsSaving(true)
    try {
      let updated = await editRecipe(currentRecipe.id, {
        title,
        ingredients,
        instructions,
        prep_time: prepTime,
        cook_time: cookTime,
        servings,
        category: currentDraft.category,
        difficulty: currentDraft.difficulty,
        tags: currentDraft.tags,
      })

      if (replacementImageFile) {
        const imageFormData = new FormData()
        imageFormData.append('recipeId', currentRecipe.id)
        imageFormData.append('image', replacementImageFile)
        const uploadedImageUrl = await uploadRecipeImage(imageFormData)
        updated = await setRecipeImage(currentRecipe.id, uploadedImageUrl)
      } else if (
        currentDraft.imageUrl &&
        currentDraft.imageUrl !== currentRecipe.image_url &&
        !currentDraft.imageUrl.startsWith('blob:')
      ) {
        updated = await setRecipeImage(currentRecipe.id, currentDraft.imageUrl)
      }

      onRecipeUpdated?.(updated as Recipe)
      setMode('view')
      setReplacementImageFile(null)
      if (replacementImagePreviewUrl) {
        URL.revokeObjectURL(replacementImagePreviewUrl)
      }
      setReplacementImagePreviewUrl(null)
      setImageMeta(null)
      setIsSelectionModalOpen(false)
      setImageCandidates([])
      setDraft(toDraft(updated as Recipe))
      toast.success('Recipe updated.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update recipe.'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddToCollection(collectionId: string) {
    if (!currentRecipe) return
    try {
      await addRecipeToCollectionAction(collectionId, currentRecipe.id)
      toast.success('Zur Sammlung hinzugefügt.')
      setIsCollectionModalOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hinzufügen fehlgeschlagen.'
      toast.error(message)
    }
  }

  async function handleCreateCollectionAndAdd() {
    if (!currentRecipe) return
    const name = newCollectionName.trim()
    if (!name) {
      toast.error('Bitte gib einen Namen ein.')
      return
    }
    setIsCreatingCollection(true)
    try {
      const collection = await createCollectionAction(name)
      await addRecipeToCollectionAction(collection.id, currentRecipe.id)
      setNewCollectionName('')
      setIsCollectionModalOpen(false)
      toast.success('Sammlung erstellt und Rezept hinzugefügt.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erstellen fehlgeschlagen.'
      toast.error(message)
    } finally {
      setIsCreatingCollection(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen)
          if (!nextOpen) {
            setMode('view')
            setConfirmDeleteOpen(false)
            resetDraftFromRecipe()
          }
        }}
      >
        <DialogContent className="w-full max-w-2xl gap-0 p-0 sm:max-w-2xl" showCloseButton>
          {mode === 'view' ? (
            <div className="flex h-[calc(100vh-2rem)] min-h-0 flex-col">
              {currentRecipe.image_url ? (
                <div className="relative h-40 w-full shrink-0 sm:h-48">
                  <Image
                    src={currentRecipe.image_url}
                    alt={currentRecipe.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 768px"
                  />
                </div>
              ) : (
                <div className="flex h-40 w-full shrink-0 items-center justify-center bg-muted/40 text-sm text-muted-foreground sm:h-48">
                  No image available
                </div>
              )}

              <DialogHeader className="gap-2 border-b border-border/70 px-5 pb-2 pt-4 pr-12">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2">
                    <DialogTitle className="text-lg leading-tight">{currentRecipe.title}</DialogTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={CATEGORY_CLASS[currentRecipe.category]}>
                        {formatCategoryLabel(currentRecipe.category)}
                      </Badge>
                      <Badge variant="outline">{formatDifficultyLabel(currentRecipe.difficulty)}</Badge>
                    </div>
                    {currentRecipe.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {currentRecipe.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <FavoriteButton
                      recipeId={currentRecipe.id}
                      isFavorite={currentRecipe.is_favorite}
                      size="md"
                      onOptimisticChange={onFavoriteChange}
                    />
                    <Button type="button" variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] touch-manipulation" onClick={() => setMode('edit')}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit recipe</span>
                    </Button>
                  </div>
                </div>

                <DialogDescription>
                  Details, Bewertung und Quelleninformationen für dieses Rezept anzeigen.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <InfoItem
                    label="Vorbereitung"
                    value={currentRecipe.prep_time > 0 ? `${currentRecipe.prep_time} min` : '—'}
                    icon={<Timer className="h-4 w-4 text-muted-foreground" />}
                  />
                  <InfoItem
                    label="Kochen"
                    value={currentRecipe.cook_time > 0 ? `${currentRecipe.cook_time} min` : '—'}
                    icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                  />
                  <InfoItem
                    label="Gesamt"
                    value={totalTime > 0 ? `${totalTime} min` : '—'}
                    icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                  />
                  <InfoItem
                    label="Portionen"
                    value={currentRecipe.servings > 0 ? String(currentRecipe.servings) : '—'}
                    icon={<UtensilsCrossed className="h-4 w-4 text-muted-foreground" />}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Ihre Bewertung</div>
                  <Rating
                    recipeId={currentRecipe.id}
                    initialRating={currentRecipe.rating}
                    size="md"
                    onOptimisticChange={onRatingChange}
                  />
                </div>

                <section className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Zutaten
                  </h4>
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                    {currentRecipe.ingredients.map((ingredient, index) => (
                      <li key={`${ingredient}-${index}`}>{ingredient}</li>
                    ))}
                  </ul>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Anleitung
                  </h4>
                  <ol className="space-y-3">
                    {instructionSteps.map((step, index) => (
                      <li key={`${step}-${index}`} className="flex gap-3 text-sm leading-relaxed">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" />
                    Drucken
                  </Button>

                  {currentRecipe.source_url ? (
                    <Button
                      type="button"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={currentRecipe.source_url} target="_blank" rel="noreferrer" />}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Quelle öffnen
                    </Button>
                  ) : null}

                  {collections.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCollectionModalOpen(true)}
                    >
                      <FolderPlus className="mr-2 h-4 w-4" />
                      Zur Sammlung
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader className="gap-2 border-b border-border/70 px-5 pb-4 pt-5 pr-12">
                <DialogTitle>Rezept bearbeiten</DialogTitle>
                <DialogDescription>Rezeptdetails aktualisieren und Änderungen speichern.</DialogDescription>
              </DialogHeader>

              <div className="max-h-[calc(90vh-9rem)] space-y-4 overflow-y-auto px-5 pb-5 pt-4">
                <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/30 p-4 md:grid-cols-2">
<div className="space-y-2 md:col-span-2">
                    <Label htmlFor="recipe-edit-title">Titel</Label>
                    <Input
                      id="recipe-edit-title"
                      value={draft.title}
                      disabled={isSaving}
                      className="bg-background/70"
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                title: event.target.value,
                              }
                            : current
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Kategorie</Label>
                    <Select
                      value={draft.category}
                      onValueChange={(value) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                category: value as RecipeCategory,
                              }
                            : current
                        )
                      }
                    >
                      <SelectTrigger className="w-full bg-background/70" disabled={isSaving}>
                        <SelectValue>
                          {(val) => (val ? CATEGORY_LABELS[val as RecipeCategory] : 'Kategorie')}
                        </SelectValue>
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
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                difficulty: value as Difficulty,
                              }
                            : current
                        )
                      }
                    >
                      <SelectTrigger className="w-full bg-background/70" disabled={isSaving}>
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
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                prepTime: event.target.value,
                              }
                            : current
                        )
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
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                cookTime: event.target.value,
                              }
                            : current
                        )
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
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                servings: event.target.value,
                              }
                            : current
                        )
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
                      {isFindingImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
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
                            setDraft((current) =>
                              current
                                ? { ...current, tags: current.tags.filter((t) => t !== tag) }
                                : current
                            )
                          }
                          className="ml-0.5 text-zinc-500 hover:text-zinc-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={draft.tagInput}
                      disabled={isSaving}
                      placeholder="Tag eingeben..."
                      className="bg-background/70"
                      onChange={(event) =>
                        setDraft((current) =>
                          current ? { ...current, tagInput: event.target.value } : current
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ',') {
                          event.preventDefault()
                          const raw = draft.tagInput.trim().toLowerCase()
                          if (raw && !draft.tags.includes(raw)) {
                            setDraft((current) =>
                              current
                                ? { ...current, tags: [...current.tags, raw], tagInput: '' }
                                : current
                            )
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
                          setDraft((current) =>
                            current
                              ? { ...current, tags: [...current.tags, raw], tagInput: '' }
                              : current
                          )
                        }
                      }}
                    >
                      Hinzufügen
                    </Button>
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
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              ingredientsText: event.target.value,
                            }
                          : current
                      )
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
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              instructionsText: event.target.value,
                            }
                          : current
                      )
                    }
                  />
                </div>

                <div className="sticky bottom-0 z-10 -mx-5 bg-background/95 px-5 py-3 backdrop-blur-sm sm:static sm:bg-transparent sm:px-0 sm:py-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2 sm:border-t-0 sm:pt-0">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setConfirmDeleteOpen(true)}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                      Rezept löschen
                    </Button>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          resetDraftFromRecipe()
                          setMode('view')
                        }}
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
            </>
          )}
        </DialogContent>
      </Dialog>

      {mode === 'edit' ? (
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
      ) : null}

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="w-full max-w-md p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
            <DialogTitle>Rezept löschen?</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie dieses Rezept löschen möchten? Dies kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 px-5 py-4">
            <Button type="button" variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmDeleteOpen(false)
                onOpenChange(false)
                onRecipeDeleteRequested?.(currentRecipe)
              }}
            >
              Löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCollectionModalOpen} onOpenChange={setIsCollectionModalOpen}>
        <DialogContent className="w-full max-w-md p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
            <DialogTitle>Zur Sammlung hinzufügen</DialogTitle>
            <DialogDescription>
              Wähle eine Sammlung oder erstelle eine neue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-2">
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => void handleAddToCollection(collection.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <span>{collection.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {collection.recipe_ids.length} Rezept{collection.recipe_ids.length === 1 ? '' : 'e'}
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-border/70 pt-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Neue Sammlung erstellen</div>
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
                  disabled={isCreatingCollection || !newCollectionName.trim()}
                >
                  {isCreatingCollection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
