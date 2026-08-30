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
  Pencil,
  Printer,
  ShoppingCart,
  Timer,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { addRecipeIngredientsToShoppingList } from '@/app/actions/shopping-list'
import { FavoriteButton } from '@/components/interactions/favorite-button'
import { Rating } from '@/components/interactions/rating'
import { deleteRecipeWithUndo } from '@/components/library/recipe-navigation'
import { AddToCollectionDialog } from '@/components/recipe/add-to-collection-dialog'
import { DeleteRecipeDialog } from '@/components/recipe/delete-recipe-dialog'
import { RecipeIngredients } from '@/components/recipe/recipe-ingredients'
import { RecipeInstructions } from '@/components/recipe/recipe-instructions'
import { RecipeNotes } from '@/components/recipe/recipe-notes'
import { ServingsStepper } from '@/components/recipe/servings-stepper'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buildRecipeMarkdown, recipeMarkdownFilename } from '@/lib/export'
import { scaleIngredient } from '@/lib/ingredient-scaling'
import { CATEGORY_CLASS, CATEGORY_LABELS, DIFFICULTY_LABELS } from '@/lib/recipe-meta'
import { toRecipeImageSrc } from '@/lib/recipe-image'
import type { Collection, Recipe } from '@/types'

type RecipeViewProps = {
  recipe: Recipe
  collections: Collection[]
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-3">
      <div className="mb-1 text-sm uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="inline-flex items-center gap-2 text-base font-medium">
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
  const [adjustedServings, setAdjustedServings] = useState(recipe.servings > 0 ? recipe.servings : 1)
  const [isAddingToShoppingList, setIsAddingToShoppingList] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setCollections(initialCollections)
  }, [initialCollections])

  useEffect(() => {
    setAdjustedServings(recipe.servings > 0 ? recipe.servings : 1)
  }, [recipe.id, recipe.servings])

  const totalTime = recipe.prep_time + recipe.cook_time
  const viewImageUrl = toRecipeImageSrc(recipe)
  const baseServings = recipe.servings > 0 ? recipe.servings : 1
  const effectiveServings = adjustedServings > 0 ? adjustedServings : baseServings
  const scaleRatio = effectiveServings !== baseServings && baseServings > 0 ? effectiveServings / baseServings : 1

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

  function handleExport() {
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
  }

  const hero = viewImageUrl ? (
    <div className="relative aspect-[4/3] max-h-[40vh] w-full overflow-hidden rounded-xl lg:max-h-none">
      <Image
        src={viewImageUrl}
        alt={recipe.title}
        fill
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 38vw"
        priority
      />
    </div>
  ) : (
    <div className="flex aspect-[4/3] max-h-[40vh] w-full items-center justify-center overflow-hidden rounded-xl bg-muted/40 text-base text-muted-foreground lg:max-h-none">
      Kein Bild vorhanden
    </div>
  )

  const actions = (
    <div data-print-hide className="space-y-2">
      <Button
        type="button"
        className="h-11 w-full min-h-[44px]"
        onClick={() => void handleAddToShoppingList()}
        disabled={isAddingToShoppingList}
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        {isAddingToShoppingList ? 'Wird hinzugefügt...' : 'Auf die Einkaufsliste'}
      </Button>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Drucken
        </Button>

        <Button type="button" variant="outline" onClick={handleExport}>
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

        <Button type="button" variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Rezept löschen
        </Button>
      </div>
    </div>
  )

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pt-8 pb-[max(6rem,env(safe-area-inset-bottom))] standalone:pt-4 nav-top:pb-8 sm:px-6 lg:px-8">
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

      <article data-print-root className="grid w-full gap-6 lg:grid-cols-[minmax(280px,38%)_1fr] lg:items-start">
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          {hero}

          <header className="space-y-2 border-b border-border/70 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{recipe.title}</h1>
                <div className="flex flex-wrap gap-2">
                  <Badge className={CATEGORY_CLASS[recipe.category]}>{CATEGORY_LABELS[recipe.category]}</Badge>
                  <Badge variant="outline">{DIFFICULTY_LABELS[recipe.difficulty]}</Badge>
                </div>
                {recipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {recipe.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
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
              <div className="mb-1 text-sm uppercase tracking-wide text-muted-foreground">Portionen</div>
              <ServingsStepper
                baseServings={baseServings}
                value={effectiveServings}
                onChange={setAdjustedServings}
              />
            </div>
          </div>

          <div data-print-hide className="space-y-2">
            <div className="text-sm font-medium">Deine Bewertung</div>
            <Rating recipeId={recipe.id} initialRating={recipe.rating} size="md" />
          </div>

          <div className="hidden lg:block">{actions}</div>
        </div>

        <div className="flex flex-col gap-6">
          <RecipeIngredients ingredients={recipe.ingredients} scaleRatio={scaleRatio} />
          <RecipeInstructions instructions={recipe.instructions} />
          <RecipeNotes notes={recipe.notes} />
          <div className="lg:hidden">{actions}</div>
        </div>
      </article>

      <DeleteRecipeDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={() => void handleConfirmDelete()}
        isDeleting={isDeleting}
      />

      <AddToCollectionDialog
        open={isCollectionModalOpen}
        onOpenChange={setIsCollectionModalOpen}
        recipeId={recipe.id}
        collections={collections}
        onCollectionsChange={setCollections}
      />
    </main>
  )
}
