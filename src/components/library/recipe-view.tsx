'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  FolderPlus,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Printer,
  ShoppingCart,
  Timer,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import { toast } from 'sonner'

import { addRecipeToCollectionAction, createCollectionAction } from '@/app/actions/collections'
import { addRecipeIngredientsToShoppingList } from '@/app/actions/shopping-list'
import { FavoriteButton } from '@/components/interactions/favorite-button'
import { Rating } from '@/components/interactions/rating'
import { deleteRecipeWithUndo } from '@/components/library/recipe-navigation'
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
import { scaleIngredient } from '@/lib/ingredient-scaling'
import { buildRecipeMarkdown, recipeMarkdownFilename } from '@/lib/export'
import { toRecipeImageSrc } from '@/lib/recipe-image'
import type { Collection, Difficulty, Recipe, RecipeCategory } from '@/types'

type RecipeViewProps = {
  recipe: Recipe
  collections: Collection[]
}

const CATEGORY_CLASS: Record<Recipe['category'], string> = {
  starter: 'bg-cyan-500/15 text-cyan-300',
  main: 'bg-amber-500/20 text-amber-300',
  dessert: 'bg-rose-500/15 text-rose-300',
  side: 'bg-emerald-500/15 text-emerald-300',
  breakfast: 'bg-yellow-500/20 text-yellow-300',
  snack: 'bg-orange-500/20 text-orange-300',
}

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

function renderNotesToHtml(notes: string): string {
  let html = notes
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  const lines = html.split('\n')
  const out: string[] = []
  let inUl = false
  let inOl = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (/^[-*+]\s+/.test(line)) {
      if (!inUl) {
        if (inOl) {
          out.push('</ol>')
          inOl = false
        }
        out.push('<ul class="list-disc pl-5 space-y-1">')
        inUl = true
      }
      out.push('<li>' + line.replace(/^[-*+]\s+/, '') + '</li>')
    } else if (/^\d+\.\s+/.test(line)) {
      if (!inOl) {
        if (inUl) {
          out.push('</ul>')
          inUl = false
        }
        out.push('<ol class="list-decimal pl-5 space-y-1">')
        inOl = true
      }
      out.push('<li>' + line.replace(/^\d+\.\s+/, '') + '</li>')
    } else {
      if (inUl) {
        out.push('</ul>')
        inUl = false
      }
      if (inOl) {
        out.push('</ol>')
        inOl = false
      }
      if (line) out.push('<p class="mb-2 last:mb-0">' + line + '</p>')
    }
  }
  if (inUl) out.push('</ul>')
  if (inOl) out.push('</ol>')

  return out.join('')
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

export function RecipeView({ recipe, collections: initialCollections }: RecipeViewProps) {
  const router = useRouter()
  const [collections, setCollections] = useState(initialCollections)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false)
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [adjustedServings, setAdjustedServings] = useState(recipe.servings > 0 ? recipe.servings : 1)
  const [isAddingToShoppingList, setIsAddingToShoppingList] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setCollections(initialCollections)
  }, [initialCollections])

  useEffect(() => {
    setAdjustedServings(recipe.servings > 0 ? recipe.servings : 1)
  }, [recipe.id, recipe.servings])

  const instructionSteps = toInstructionSteps(recipe.instructions)
  const totalTime = recipe.prep_time + recipe.cook_time
  const viewImageUrl = toRecipeImageSrc(recipe)
  const baseServings = recipe.servings > 0 ? recipe.servings : 1
  const effectiveServings = adjustedServings > 0 ? adjustedServings : baseServings
  const scaleRatio = effectiveServings !== baseServings && baseServings > 0 ? effectiveServings / baseServings : 1

  async function handleAddToCollection(collectionId: string) {
    try {
      await addRecipeToCollectionAction(collectionId, recipe.id)
      setCollections((current) =>
        current.map((collection) =>
          collection.id === collectionId && !collection.recipe_ids.includes(recipe.id)
            ? { ...collection, recipe_ids: [...collection.recipe_ids, recipe.id] }
            : collection
        )
      )
      toast.success('Zur Sammlung hinzugefügt.')
      setIsCollectionModalOpen(false)
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
    setIsCreatingCollection(true)
    try {
      const collection = await createCollectionAction(name)
      await addRecipeToCollectionAction(collection.id, recipe.id)
      const withRecipe = collection.recipe_ids.includes(recipe.id)
        ? collection
        : { ...collection, recipe_ids: [...collection.recipe_ids, recipe.id] }
      setCollections((current) => [...current, withRecipe])
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

  async function handleAddToShoppingList() {
    const displayed = recipe.ingredients.map((ingredient) =>
      scaleRatio !== 1 ? scaleIngredient(ingredient, scaleRatio) : ingredient
    )

    if (displayed.length === 0) {
      toast.error('Keine Zutaten vorhanden.')
      return
    }

    setIsAddingToShoppingList(true)
    try {
      await addRecipeIngredientsToShoppingList({
        items: displayed,
        sourceRecipeTitle: recipe.title,
        sourceServings: effectiveServings,
      })
      toast.success('Zutaten zur Einkaufsliste hinzugefügt.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hinzufügen fehlgeschlagen.'
      toast.error(message)
    } finally {
      setIsAddingToShoppingList(false)
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true)
    try {
      await deleteRecipeWithUndo(recipe, (href) => {
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
      <div data-print-hide className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          nativeButton={false}
          render={
            <Link
              href="/library"
              onClick={(event) => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  event.preventDefault()
                  router.back()
                }
              }}
            />
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
      </div>

      <article data-print-root className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {viewImageUrl ? (
          <div className="relative h-40 w-full sm:h-48">
            <Image
              src={viewImageUrl}
              alt={recipe.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 768px"
              priority
            />
          </div>
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground sm:h-48">
            Kein Bild vorhanden
          </div>
        )}

        <header className="space-y-2 border-b border-border/70 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              <h1 className="text-lg leading-tight font-semibold">{recipe.title}</h1>
              <div className="flex flex-wrap gap-2">
                <Badge className={CATEGORY_CLASS[recipe.category]}>
                  {formatCategoryLabel(recipe.category)}
                </Badge>
                <Badge variant="outline">{formatDifficultyLabel(recipe.difficulty)}</Badge>
              </div>
              {recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {recipe.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div data-print-hide className="flex items-center gap-1">
              <FavoriteButton recipeId={recipe.id} isFavorite={recipe.is_favorite} size="md" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] touch-manipulation"
                nativeButton={false}
                render={<Link href={`/library/${recipe.id}/edit`} />}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Rezept bearbeiten</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <InfoItem
            label="Vorbereitung"
            value={recipe.prep_time > 0 ? `${recipe.prep_time} min` : '—'}
            icon={<Timer className="h-4 w-4 text-muted-foreground" />}
          />
          <InfoItem
            label="Kochen"
            value={recipe.cook_time > 0 ? `${recipe.cook_time} min` : '—'}
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          />
          <InfoItem
            label="Gesamt"
            value={totalTime > 0 ? `${totalTime} min` : '—'}
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          />
          <div className="rounded-lg border border-border/70 bg-background/40 p-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Portionen</div>
            <div className="flex items-center gap-1 text-sm font-medium">
              <UtensilsCrossed className="h-4 w-4 text-muted-foreground shrink-0" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                data-print-hide
                disabled={effectiveServings <= 1}
                onClick={() => setAdjustedServings(Math.max(1, effectiveServings - 1))}
                aria-label="Eine Portion weniger"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>

              {scaleRatio !== 1 ? (
                <button
                  type="button"
                  className="inline-flex min-h-[44px] min-w-[2.75rem] items-center justify-center gap-0.5 rounded-lg tabular-nums text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 touch-manipulation"
                  onClick={() => setAdjustedServings(baseServings)}
                  aria-label={`Auf ${baseServings} Portionen zurücksetzen`}
                  title={`Auf ${baseServings} Portionen zurücksetzen`}
                >
                  {effectiveServings}
                  <span aria-hidden="true" className="text-xs text-primary/80">
                    *
                  </span>
                </button>
              ) : (
                <span className="tabular-nums min-w-[1.5rem] text-center">{effectiveServings}</span>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                data-print-hide
                disabled={effectiveServings >= 99}
                onClick={() => setAdjustedServings(Math.min(99, effectiveServings + 1))}
                aria-label="Eine Portion mehr"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div data-print-hide className="space-y-2">
          <div className="text-sm font-medium">Deine Bewertung</div>
          <Rating recipeId={recipe.id} initialRating={recipe.rating} size="md" />
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Zutaten</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {recipe.ingredients.map((ingredient, index) => {
              const display = scaleRatio !== 1 ? scaleIngredient(ingredient, scaleRatio) : ingredient
              return <li key={index}>{display}</li>
            })}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Anleitung</h2>
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

        {recipe.notes && recipe.notes.trim() ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Anmerkungen
            </h2>
            <div
              className="text-sm leading-relaxed text-foreground/90"
              dangerouslySetInnerHTML={{ __html: renderNotesToHtml(recipe.notes) }}
            />
          </section>
        ) : null}

        <div data-print-hide className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Drucken
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const markdown = buildRecipeMarkdown(recipe)
              const fileName = recipeMarkdownFilename(recipe.title)
              const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const anchor = document.createElement('a')
              anchor.href = url
              anchor.download = fileName
              document.body.append(anchor)
              anchor.click()
              anchor.remove()
              URL.revokeObjectURL(url)
              toast.success('Rezept exportiert.')
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Exportieren
          </Button>

          {recipe.source_url ? (
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href={recipe.source_url} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Quelle öffnen
            </Button>
          ) : null}

          <Button type="button" variant="outline" onClick={() => setIsCollectionModalOpen(true)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Zur Sammlung
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleAddToShoppingList()}
            disabled={isAddingToShoppingList}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {isAddingToShoppingList ? 'Wird hinzugefügt...' : 'Zur Einkaufsliste'}
          </Button>

          <Button type="button" variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Rezept löschen
          </Button>
        </div>
      </article>

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

      <Dialog open={isCollectionModalOpen} onOpenChange={setIsCollectionModalOpen}>
        <DialogContent className="w-full max-w-md p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
            <DialogTitle>Zur Sammlung hinzufügen</DialogTitle>
            <DialogDescription>Wähle eine Sammlung oder erstelle eine neue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-2">
              {collections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Sammlungen. Erstelle unten deine erste.
                </p>
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
                  {isCreatingCollection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
