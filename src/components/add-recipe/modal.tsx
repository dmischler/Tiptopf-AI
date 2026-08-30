'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  extractFromImageAction,
  extractFromUrlAction,
  findRecipeImageAction,
} from '@/app/actions/extract-recipe'
import { saveRecipe } from '@/app/actions/add-recipe'
import { ImageUpload } from '@/components/add-recipe/image-upload'
import { ManualForm } from '@/components/add-recipe/manual-form'
import { RecipePreview, type EditableRecipePreview } from '@/components/add-recipe/preview'
import { StreamingProgress, type Stage } from '@/components/add-recipe/streaming-progress'
import { UrlInput } from '@/components/add-recipe/url-input'
import { parseRecipeFieldsForSave } from '@/components/recipe/recipe-fields'
import { ImageSelectionHost } from '@/components/recipe/image-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isCanonicalRecipeImageUrl } from '@/lib/recipe-image'
import type { ParsedRecipe, Recipe } from '@/types'

type ModalPhase = 'input' | 'parsing' | 'preview' | 'saving'

type AddRecipeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecipeSaved?: (recipe: Recipe) => void
  initialUrl?: string
  initialMode?: 'image' | 'url' | 'manual'
  allTags?: string[]
}

type ExtractedRecipePayload = ParsedRecipe & {
  image_url?: string | null
  source_url?: string | null
  source_type: 'image' | 'url'
}

type ImageMeta = {
  creditName?: string
  creditUrl?: string
}

function buildEditableState(recipe: ExtractedRecipePayload): EditableRecipePreview {
  return {
    title: recipe.title,
    category: recipe.category,
    difficulty: recipe.difficulty,
    prepTime: recipe.prep_time,
    cookTime: recipe.cook_time,
    servings: recipe.servings,
    ingredientsText: recipe.ingredients.join('\n'),
    instructionsText: recipe.instructions,
    notes: '',
    tags: recipe.tags ?? [],
    imageUrl: recipe.image_url ?? null,
    sourceUrl: recipe.source_url ?? null,
    sourceType: recipe.source_type,
  }
}

export function AddRecipeModal({
  open,
  onOpenChange,
  onRecipeSaved,
  initialUrl,
  initialMode = 'image',
  allTags = [],
}: AddRecipeModalProps) {
  const router = useRouter()
  const extractGenRef = useRef(0)
  const [activeTab, setActiveTab] = useState<'image' | 'url' | 'manual'>(initialMode)
  const [phase, setPhase] = useState<ModalPhase>('input')
  const [progressStage, setProgressStage] = useState<Stage>('fetching')
  const [streamText, setStreamText] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipePayload | null>(null)
  const [previewState, setPreviewState] = useState<EditableRecipePreview | null>(null)
  const [replacementImageFile, setReplacementImageFile] = useState<File | null>(null)
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null)
  const [isManualSaving, setIsManualSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setActiveTab(initialMode)
    if (initialUrl) {
      setUrlInput(initialUrl)
      toast.success('URL aus der Zwischenablage erkannt', { duration: 2000 })
    }
  }, [open, initialUrl, initialMode])

  function resetState() {
    extractGenRef.current += 1
    setPhase('input')
    setProgressStage('fetching')
    setStreamText('')
    setUrlInput('')
    setExtractedRecipe(null)
    setPreviewState(null)
    setReplacementImageFile(null)
    setImageMeta(null)
    setIsManualSaving(false)
  }

  async function handleExtractFromUrl() {
    const url = urlInput.trim()
    if (!url) {
      toast.error('Bitte zuerst eine URL eingeben.')
      return
    }

    if (!/^https?:\/\//i.test(url)) {
      toast.error('URL muss mit http:// oder https:// beginnen.')
      return
    }

    const gen = ++extractGenRef.current
    setPhase('parsing')
    setProgressStage('fetching')
    setStreamText('Seite wird geladen...')

    try {
      const recipe = await extractFromUrlAction(url)
      if (gen !== extractGenRef.current) return

      setProgressStage('structuring')
      setStreamText('Felder werden strukturiert...')

      const withImage = await runAutoImageFallback(recipe, gen)
      if (gen !== extractGenRef.current) return

      setExtractedRecipe(withImage)
      setPreviewState(buildEditableState(withImage))
      setProgressStage('complete')
      setPhase('preview')
    } catch (error) {
      if (gen !== extractGenRef.current) return
      const message = error instanceof Error ? error.message : 'Extrahieren von der URL fehlgeschlagen.'
      setProgressStage('error')
      toast.error(message)
      setPhase('input')
    }
  }

  async function handleExtractFromImage(imageBase64: string) {
    const gen = ++extractGenRef.current
    setPhase('parsing')
    setProgressStage('parsing')
    setStreamText('Rezeptbild wird analysiert...')

    try {
      const recipe = await extractFromImageAction(imageBase64)
      if (gen !== extractGenRef.current) return

      setProgressStage('structuring')
      setStreamText('Zutaten und Anleitung werden strukturiert...')

      const withImage = await runAutoImageFallback(recipe, gen)
      if (gen !== extractGenRef.current) return

      setExtractedRecipe(withImage)
      setPreviewState(buildEditableState(withImage))
      setProgressStage('complete')
      setPhase('preview')
    } catch (error) {
      if (gen !== extractGenRef.current) return
      const message = error instanceof Error ? error.message : 'Extrahieren vom Bild fehlgeschlagen.'
      setProgressStage('error')
      toast.error(message)
      setPhase('input')
    }
  }

  async function runAutoImageFallback(recipe: ExtractedRecipePayload, gen: number) {
    if (recipe.image_url) {
      return recipe
    }

    if (gen !== extractGenRef.current) {
      return recipe
    }

    try {
      setProgressStage('finding_image')
      setStreamText('Kein Quellbild. Passende Fotos werden gesucht...')

      const resolved = await findRecipeImageAction({
        title: recipe.title,
        category: recipe.category,
        ingredients: recipe.ingredients,
      })

      if (gen !== extractGenRef.current) {
        return recipe
      }

      if (!resolved?.imageUrl) {
        return recipe
      }

      setImageMeta({
        creditName: resolved.creditName,
        creditUrl: resolved.creditUrl,
      })

      return {
        ...recipe,
        image_url: resolved.imageUrl,
      }
    } catch {
      return recipe
    }
  }

  async function handleSave() {
    if (!extractedRecipe || !previewState) {
      toast.error('Kein Rezept zum Speichern.')
      return
    }

    let parsed: ReturnType<typeof parseRecipeFieldsForSave>
    try {
      parsed = parseRecipeFieldsForSave(previewState)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ungültiger Zahlenwert.'
      toast.error(message)
      return
    }

    setPhase('saving')

    try {
      const previewUrl = replacementImageFile ? null : parsed.imageUrl
      const isRemote = Boolean(previewUrl && /^https?:\/\//i.test(previewUrl))
      const canonicalImageUrl = previewUrl && isCanonicalRecipeImageUrl(previewUrl) ? previewUrl.split(/[?#]/)[0] : null
      const intendedImage = Boolean(replacementImageFile || isRemote || canonicalImageUrl)

      const saved = await saveRecipe(
        {
          title: parsed.title,
          ingredients: parsed.ingredients,
          instructions: parsed.instructions,
          prepTime: parsed.prepTime,
          cookTime: parsed.cookTime,
          servings: parsed.servings,
          category: parsed.category,
          difficulty: parsed.difficulty,
          imageUrl: canonicalImageUrl,
          remoteImageUrl: isRemote ? previewUrl : null,
          sourceUrl: previewState.sourceUrl,
          sourceType: previewState.sourceType,
          tags: parsed.tags,
          notes: parsed.notes,
        },
        replacementImageFile
      )

      onRecipeSaved?.(saved as Recipe)

      if (intendedImage && !saved.image_url) {
        toast.error('Rezept gespeichert, Bild konnte nicht geladen werden.')
      } else {
        toast.success('Rezept gespeichert.')
      }
      onOpenChange(false)
      resetState()
      router.push(`/library/${saved.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rezept konnte nicht gespeichert werden.'
      toast.error(message)
      setPhase('preview')
    }
  }

  async function handleSaveManual(
    recipe: import('@/components/add-recipe/manual-form').ManualRecipeInput,
    imageFile: File | null
  ) {
    setIsManualSaving(true)

    try {
      const isRemote = Boolean(recipe.imageUrl && /^https?:\/\//i.test(recipe.imageUrl))
      const intendedImage = Boolean(imageFile || isRemote)

      const saved = await saveRecipe(
        {
          title: recipe.title,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
          category: recipe.category,
          difficulty: recipe.difficulty,
          imageUrl: null,
          remoteImageUrl: isRemote ? recipe.imageUrl : null,
          sourceUrl: null,
          sourceType: 'manual',
          tags: recipe.tags,
          notes: recipe.notes,
        },
        imageFile
      )

      onRecipeSaved?.(saved as Recipe)

      if (intendedImage && !saved.image_url) {
        toast.error('Rezept gespeichert, Bild konnte nicht geladen werden.')
      } else {
        toast.success('Rezept gespeichert.')
      }
      onOpenChange(false)
      resetState()
      router.push(`/library/${saved.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rezept konnte nicht gespeichert werden.'
      toast.error(message)
    } finally {
      setIsManualSaving(false)
    }
  }

  return (
    <ImageSelectionHost>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen)
          if (!nextOpen) {
            resetState()
          }
        }}
      >
        <DialogContent className="w-full p-0 nav-top:max-w-4xl">
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12 sm:px-6 sm:pt-6">
            <DialogTitle>Rezept hinzufügen</DialogTitle>
            <DialogDescription>
              Foto aufnehmen oder URL einfügen. Die KI strukturiert das Rezept.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(calc(92svh-7.5rem),calc(1000px-7.5rem))] space-y-4 overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6 nav-top:max-h-[calc(100vh-10rem)]">
            {phase === 'input' && (
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'image' | 'url' | 'manual')}>
                <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/60 p-1">
                  <TabsTrigger value="image">Bild</TabsTrigger>
                  <TabsTrigger value="url">URL</TabsTrigger>
                  <TabsTrigger value="manual">Manuell</TabsTrigger>
                </TabsList>

                <TabsContent value="image" className="pt-4">
                  <ImageUpload
                    onSelect={handleExtractFromImage}
                    onError={(message) => toast.error(message)}
                  />
                </TabsContent>

                <TabsContent value="url" className="pt-4">
                  <UrlInput value={urlInput} onValueChange={setUrlInput} onExtract={handleExtractFromUrl} />
                </TabsContent>

                <TabsContent value="manual" className="pt-4">
                  <ManualForm
                    onSave={handleSaveManual}
                    onCancel={() => {
                      onOpenChange(false)
                      resetState()
                    }}
                    isSaving={isManualSaving}
                    allTags={allTags}
                  />
                </TabsContent>
              </Tabs>
            )}

            {phase === 'parsing' && <StreamingProgress stage={progressStage} streamText={streamText} />}

            {phase === 'preview' && extractedRecipe && previewState && (
              <RecipePreview
                parsedRecipe={extractedRecipe}
                value={previewState}
                disabled={false}
                imageCreditName={imageMeta?.creditName ?? null}
                imageCreditUrl={imageMeta?.creditUrl ?? null}
                allTags={allTags}
                onChange={setPreviewState}
                onSave={handleSave}
                onCancel={() => {
                  resetState()
                  onOpenChange(false)
                }}
                onImageFileChange={setReplacementImageFile}
              />
            )}

            {phase === 'saving' && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Rezept wird gespeichert...
              </div>
            )}

            {phase !== 'saving' && phase !== 'preview' && activeTab !== 'manual' && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false)
                    resetState()
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ImageSelectionHost>
  )
}
