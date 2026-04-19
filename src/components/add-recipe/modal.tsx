'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  applyRecipeImageCandidateAction,
  extractFromImageAction,
  extractFromUrlAction,
  findRecipeImageAction,
  generateRecipeImageAction,
  searchRecipeImageCandidatesAction,
} from '@/app/actions/extract-recipe'
import { saveRecipe, uploadRecipeImage } from '@/app/actions/add-recipe'
import { ImageSelectionModal } from '@/components/add-recipe/image-selection-modal'
import { ImageUpload } from '@/components/add-recipe/image-upload'
import { RecipePreview, type EditableRecipePreview } from '@/components/add-recipe/preview'
import { StreamingProgress, type Stage } from '@/components/add-recipe/streaming-progress'
import { UrlInput } from '@/components/add-recipe/url-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ParsedRecipe, Recipe } from '@/types'
import type { RecipeImageCandidate } from '@/lib/ai/image-types'

type ModalPhase = 'input' | 'parsing' | 'preview' | 'saving'

type AddRecipeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecipeSaved?: (recipe: Recipe) => void
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
    servings: recipe.servings,
    imageUrl: recipe.image_url ?? null,
    sourceUrl: recipe.source_url ?? null,
    sourceType: recipe.source_type,
  }
}

export function AddRecipeModal({ open, onOpenChange, onRecipeSaved }: AddRecipeModalProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'url'>('image')
  const [phase, setPhase] = useState<ModalPhase>('input')
  const [progressStage, setProgressStage] = useState<Stage>('fetching')
  const [streamText, setStreamText] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipePayload | null>(null)
  const [previewState, setPreviewState] = useState<EditableRecipePreview | null>(null)
  const [replacementImageFile, setReplacementImageFile] = useState<File | null>(null)
  const [replacementImagePreviewUrl, setReplacementImagePreviewUrl] = useState<string | null>(null)
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null)
  const [isFindingImage, setIsFindingImage] = useState(false)
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false)
  const [imageCandidates, setImageCandidates] = useState<RecipeImageCandidate[]>([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState(false)

  useEffect(() => {
    if (!replacementImagePreviewUrl) return
    return () => {
      URL.revokeObjectURL(replacementImagePreviewUrl)
    }
  }, [replacementImagePreviewUrl])

  function resetState() {
    setPhase('input')
    setProgressStage('fetching')
    setStreamText('')
    setUrlInput('')
    setExtractedRecipe(null)
    setPreviewState(null)
    setReplacementImageFile(null)
    setImageMeta(null)
    setIsFindingImage(false)
    setIsSelectionModalOpen(false)
    setImageCandidates([])
    setIsLoadingCandidates(false)
    setIsGeneratingAiImage(false)
    if (replacementImagePreviewUrl) {
      URL.revokeObjectURL(replacementImagePreviewUrl)
    }
    setReplacementImagePreviewUrl(null)
  }

  async function handleExtractFromUrl() {
    const url = urlInput.trim()
    if (!url) {
      toast.error('Please enter a URL first.')
      return
    }

    if (!/^https?:\/\//i.test(url)) {
      toast.error('URL must start with http:// or https://')
      return
    }

    setPhase('parsing')
    setProgressStage('fetching')
    setStreamText('Fetching page content...')

    try {
      const recipe = await extractFromUrlAction(url)
      setProgressStage('structuring')
      setStreamText('Parsing and structuring fields...')

      const withImage = await runAutoImageFallback(recipe)

      setExtractedRecipe(withImage)
      setPreviewState(buildEditableState(withImage))
      setProgressStage('complete')
      setPhase('preview')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extract from URL.'
      setProgressStage('error')
      toast.error(message)
      setPhase('input')
    }
  }

  async function handleExtractFromImage(imageBase64: string) {
    setPhase('parsing')
    setProgressStage('parsing')
    setStreamText('Analyzing recipe image...')

    try {
      const recipe = await extractFromImageAction(imageBase64)
      setProgressStage('structuring')
      setStreamText('Structuring ingredients and instructions...')

      const withImage = await runAutoImageFallback(recipe)

      setExtractedRecipe(withImage)
      setPreviewState(buildEditableState(withImage))
      setProgressStage('complete')
      setPhase('preview')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extract from image.'
      setProgressStage('error')
      toast.error(message)
      setPhase('input')
    }
  }

  async function handleReplaceImage(file: File) {
    if (!previewState) return

    if (replacementImagePreviewUrl) {
      URL.revokeObjectURL(replacementImagePreviewUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setReplacementImageFile(file)
    setReplacementImagePreviewUrl(objectUrl)
    setImageMeta(null)
    setPreviewState({
      ...previewState,
      imageUrl: objectUrl,
    })
  }

  function applyResolvedImage(imageUrl: string, meta: ImageMeta | null = null) {
    if (!previewState) {
      return
    }

    if (replacementImagePreviewUrl) {
      URL.revokeObjectURL(replacementImagePreviewUrl)
      setReplacementImagePreviewUrl(null)
    }

    setReplacementImageFile(null)
    setExtractedRecipe((current) =>
      current
        ? {
            ...current,
            image_url: imageUrl,
          }
        : current
    )
    setImageMeta(meta)
    setPreviewState({
      ...previewState,
      imageUrl,
    })
  }

  async function runAutoImageFallback(recipe: ExtractedRecipePayload) {
    if (recipe.image_url) {
      return recipe
    }

    try {
      setProgressStage('finding_image')
      setStreamText('No source image found. Looking up matching photos...')

      const resolved = await findRecipeImageAction({
        title: recipe.title,
        category: recipe.category,
        ingredients: recipe.ingredients,
      })

      if (!resolved?.imageUrl) {
        return recipe
      }

      setImageMeta({
        creditName: resolved.creditName,
        creditUrl: resolved.creditUrl,
      })

      setExtractedRecipe((current) =>
        current
          ? {
              ...current,
              image_url: resolved.imageUrl,
            }
          : current
      )

      return {
        ...recipe,
        image_url: resolved.imageUrl,
      }
    } catch {
      return recipe
    }
  }

  async function loadImageCandidates() {
    if (!previewState || !extractedRecipe) {
      return [] as RecipeImageCandidate[]
    }

    setIsLoadingCandidates(true)
    try {
      const candidates = await searchRecipeImageCandidatesAction(previewState.title, previewState.category)
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

  async function handleGenerateAiImageFromModal() {
    if (!previewState || !extractedRecipe) {
      return
    }

    setIsGeneratingAiImage(true)
    try {
      const resolved = await generateRecipeImageAction({
        title: previewState.title,
        category: previewState.category,
        ingredients: extractedRecipe.ingredients,
      })

      if (!resolved?.imageUrl) {
        toast.error('Could not generate an image right now.')
        return
      }

      applyResolvedImage(resolved.imageUrl, {
        creditName: resolved.creditName,
        creditUrl: resolved.creditUrl,
      })
      setIsSelectionModalOpen(false)
      toast.success('AI image generated.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate AI image.'
      toast.error(message)
    } finally {
      setIsGeneratingAiImage(false)
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

  async function handleFindImageManual() {
    if (!previewState || !extractedRecipe) {
      return
    }

    setIsFindingImage(true)
    try {
      const candidates = await loadImageCandidates()
      setIsSelectionModalOpen(true)
      if (!previewState.imageUrl && candidates.length === 0) {
        toast.info('No external matches yet. You can generate an AI image in the picker.')
      }
    } finally {
      setIsFindingImage(false)
    }
  }

  async function handleSave() {
    if (!extractedRecipe || !previewState) {
      toast.error('No recipe to save.')
      return
    }

    setPhase('saving')

    try {
      const saved = await saveRecipe({
        title: previewState.title,
        ingredients: extractedRecipe.ingredients,
        instructions: extractedRecipe.instructions,
        prepTime: extractedRecipe.prep_time,
        cookTime: extractedRecipe.cook_time,
        servings: previewState.servings,
        category: previewState.category,
        difficulty: previewState.difficulty,
        imageUrl: replacementImageFile ? null : previewState.imageUrl,
        sourceUrl: previewState.sourceUrl,
        sourceType: previewState.sourceType,
      })

      let persistedImageUrl = saved.image_url as string | null

      if (replacementImageFile) {
        try {
          const imageFormData = new FormData()
          imageFormData.append('recipeId', saved.id)
          imageFormData.append('image', replacementImageFile)
          persistedImageUrl = await uploadRecipeImage(imageFormData)
        } catch {
          toast.error('Recipe saved, but replacing the image failed.')
        }
      }

      onRecipeSaved?.({
        ...(saved as Recipe),
        image_url: persistedImageUrl,
      })

      toast.success('Recipe saved to your library.')
      onOpenChange(false)
      resetState()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save recipe.'
      toast.error(message)
      setPhase('preview')
    }
  }

  const previewImageUrl = useMemo(
    () => replacementImagePreviewUrl ?? previewState?.imageUrl ?? extractedRecipe?.image_url ?? null,
    [replacementImagePreviewUrl, previewState?.imageUrl, extractedRecipe?.image_url]
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          resetState()
        }
      }}
    >
      <DialogContent className="w-full max-w-4xl p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12 sm:px-6 sm:pt-6">
          <DialogTitle>Add recipe</DialogTitle>
          <DialogDescription>
            Upload a photo or paste a URL. AI extracts the recipe structure automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-7.5rem)] space-y-4 overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          {phase === 'input' && (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'image' | 'url')}>
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
                <TabsTrigger value="image">Upload image</TabsTrigger>
                <TabsTrigger value="url">Paste URL</TabsTrigger>
              </TabsList>

              <TabsContent value="image" className="pt-4">
                <ImageUpload
                  onSelect={handleExtractFromImage}
                  onError={(message) => toast.error(message)}
                />
              </TabsContent>

              <TabsContent value="url" className="pt-4">
                <UrlInput
                  value={urlInput}
                  onValueChange={setUrlInput}
                  onExtract={handleExtractFromUrl}
                />
              </TabsContent>
            </Tabs>
          )}

          {phase === 'parsing' && <StreamingProgress stage={progressStage} streamText={streamText} />}

          {phase === 'preview' && extractedRecipe && previewState && (
            <RecipePreview
              parsedRecipe={extractedRecipe}
              value={{
                ...previewState,
                imageUrl: previewImageUrl,
              }}
              isFindingImage={isFindingImage}
              imageCreditName={imageMeta?.creditName ?? null}
              imageCreditUrl={imageMeta?.creditUrl ?? null}
              onChange={setPreviewState}
              onSave={handleSave}
              onCancel={() => {
                resetState()
                onOpenChange(false)
              }}
              onReplaceImage={handleReplaceImage}
              onFindImage={handleFindImageManual}
            />
          )}

          {phase === 'saving' && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving recipe...
            </div>
          )}

          {phase !== 'saving' && phase !== 'preview' && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  resetState()
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {phase === 'preview' && previewState && (
          <ImageSelectionModal
            open={isSelectionModalOpen}
            loading={isLoadingCandidates}
            title={previewState.title}
            candidates={imageCandidates}
            onOpenChange={setIsSelectionModalOpen}
            onSelectCandidate={(candidate) => {
              void handleSelectImageCandidate(candidate)
            }}
            onGenerateAi={() => {
              void handleGenerateAiImageFromModal()
            }}
            onRefreshSearch={() => {
              void loadImageCandidates()
            }}
            isGeneratingAi={isGeneratingAiImage}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
