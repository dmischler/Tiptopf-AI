'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { extractFromImageAction, extractFromUrlAction } from '@/app/actions/extract-recipe'
import { saveRecipe, uploadRecipeImage } from '@/app/actions/add-recipe'
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
import type { ParsedRecipe } from '@/types'

type ModalPhase = 'input' | 'parsing' | 'preview' | 'saving'

type AddRecipeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ExtractedRecipePayload = ParsedRecipe & {
  image_url?: string | null
  source_url?: string | null
  source_type: 'image' | 'url'
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

export function AddRecipeModal({ open, onOpenChange }: AddRecipeModalProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'url'>('image')
  const [phase, setPhase] = useState<ModalPhase>('input')
  const [progressStage, setProgressStage] = useState<Stage>('fetching')
  const [streamText, setStreamText] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipePayload | null>(null)
  const [previewState, setPreviewState] = useState<EditableRecipePreview | null>(null)
  const [replacementImageFile, setReplacementImageFile] = useState<File | null>(null)
  const [replacementImagePreviewUrl, setReplacementImagePreviewUrl] = useState<string | null>(null)

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

      setExtractedRecipe(recipe)
      setPreviewState(buildEditableState(recipe))
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

      setExtractedRecipe(recipe)
      setPreviewState(buildEditableState(recipe))
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
    setPreviewState({
      ...previewState,
      imageUrl: objectUrl,
    })
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

      if (replacementImageFile) {
        const imageFormData = new FormData()
        imageFormData.append('recipeId', saved.id)
        imageFormData.append('image', replacementImageFile)
        await uploadRecipeImage(imageFormData)
      }

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
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add recipe</DialogTitle>
          <DialogDescription>
            Upload a photo or paste a URL. AI extracts the recipe structure automatically.
          </DialogDescription>
        </DialogHeader>

        {phase === 'input' && (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'image' | 'url')}>
            <TabsList className="grid w-full grid-cols-2">
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
            onChange={setPreviewState}
            onSave={handleSave}
            onCancel={() => {
              resetState()
              onOpenChange(false)
            }}
            onReplaceImage={handleReplaceImage}
          />
        )}

        {phase === 'saving' && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-card/50 p-6 text-sm text-muted-foreground">
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
      </DialogContent>
    </Dialog>
  )
}
