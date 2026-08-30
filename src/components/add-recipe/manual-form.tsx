'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, UploadCloud, X } from 'lucide-react'

import { searchRecipeImageCandidatesAction } from '@/app/actions/extract-recipe'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImageSelectionModal } from '@/components/add-recipe/image-selection-modal'
import type { Difficulty, RecipeCategory } from '@/types'
import type { RecipeImageCandidate } from '@/lib/ai/image-types'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024

export type ManualRecipeInput = {
  title: string
  ingredients: string[]
  instructions: string
  prepTime: number
  cookTime: number
  servings: number
  category: RecipeCategory
  difficulty: Difficulty
  tags: string[]
  imageUrl: string | null
}

type ManualFormProps = {
  onSave: (recipe: ManualRecipeInput, imageFile: File | null) => Promise<void>
  onCancel: () => void
  isSaving: boolean
  allTags?: string[]
}

export function ManualForm({ onSave, onCancel, isSaving, allTags = [] }: ManualFormProps) {
  const [title, setTitle] = useState('')
  const [ingredientsText, setIngredientsText] = useState('')
  const [instructionsText, setInstructionsText] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [servings, setServings] = useState('')
  const [category, setCategory] = useState<RecipeCategory>('main')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null)
  const [isSearchingImage, setIsSearchingImage] = useState(false)
  const [isSelectionOpen, setIsSelectionOpen] = useState(false)
  const [imageCandidates, setImageCandidates] = useState<RecipeImageCandidate[]>([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const imageSearchEnabled = title.trim().length > 0

  const tagSuggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase()
    if (!query) return []
    return allTags
      .filter((tag) => !tags.includes(tag))
      .filter((tag) => tag.toLowerCase().includes(query))
      .slice(0, 6)
  }, [tagInput, tags, allTags])

  useEffect(() => {
    if (!imagePreviewUrl) return
    return () => {
      URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  function handleAddTag(raw?: string) {
    const value = (raw ?? tagInput).trim().toLowerCase()
    if (value && !tags.includes(value)) {
      setTags((current) => [...current, value])
    }
    setTagInput('')
  }

  function handleRemoveTag(tag: string) {
    setTags((current) => current.filter((t) => t !== tag))
  }

  async function handleFileSelect(file: File | null) {
    if (!file) return
    if (!ALLOWED_TYPES.has(file.type)) {
      return
    }
    if (file.size > MAX_BYTES) {
      return
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setImageFile(file)
    setImagePreviewUrl(objectUrl)
    setResolvedImageUrl(null)
  }

  function handleRemoveImage() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    setImageFile(null)
    setImagePreviewUrl(null)
    setResolvedImageUrl(null)
  }

  async function handleSearchImage() {
    if (!imageSearchEnabled) return
    setIsSearchingImage(true)
    setIsLoadingCandidates(true)
    setIsSelectionOpen(true)
    try {
      const candidates = await searchRecipeImageCandidatesAction(title.trim(), category)
      setImageCandidates(candidates)
    } catch {
      setImageCandidates([])
    } finally {
      setIsLoadingCandidates(false)
      setIsSearchingImage(false)
    }
  }

  function handleSelectCandidate(candidate: RecipeImageCandidate) {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    setImageFile(null)
    setImagePreviewUrl(null)
    setResolvedImageUrl(candidate.url)
    setIsSelectionOpen(false)
  }

  async function handleSubmit() {
    const recipe: ManualRecipeInput = {
      title: title.trim(),
      ingredients: ingredientsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      instructions: instructionsText.trim(),
      prepTime: Number(prepTime) || 0,
      cookTime: Number(cookTime) || 0,
      servings: Number(servings) || 1,
      category,
      difficulty,
      tags,
      imageUrl: imageFile ? null : resolvedImageUrl,
    }

    await onSave(recipe, imageFile)
  }

  const currentImageUrl = resolvedImageUrl ?? imagePreviewUrl

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="manual-title">Titel</Label>
        <Input
          id="manual-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSaving}
          placeholder="Rezepttitel"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-ingredients">Zutaten (eine pro Zeile)</Label>
        <textarea
          id="manual-ingredients"
          value={ingredientsText}
          onChange={(e) => setIngredientsText(e.target.value)}
          disabled={isSaving}
          rows={8}
          className="min-h-36 w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="200g Mehl&#10;3 Eier&#10;..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-instructions">Anleitung (ein Schritt pro Zeile)</Label>
        <textarea
          id="manual-instructions"
          value={instructionsText}
          onChange={(e) => setInstructionsText(e.target.value)}
          disabled={isSaving}
          rows={10}
          className="min-h-40 w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="Ofen auf 180°C vorheizen&#10;Mehl und Eier vermischen&#10;..."
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="manual-prep">Zubereitung (min)</Label>
          <Input
            id="manual-prep"
            type="number"
            min={0}
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-cook">Kochzeit (min)</Label>
          <Input
            id="manual-cook"
            type="number"
            min={0}
            value={cookTime}
            onChange={(e) => setCookTime(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-servings">Portionen</Label>
          <Input
            id="manual-servings"
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Kategorie</Label>
          <Select value={category} onValueChange={(value) => setCategory(value as RecipeCategory)} disabled={isSaving}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Vorspeise</SelectItem>
              <SelectItem value="main">Hauptgericht</SelectItem>
              <SelectItem value="dessert">Dessert</SelectItem>
              <SelectItem value="side">Beilage</SelectItem>
              <SelectItem value="breakfast">Frühstück</SelectItem>
              <SelectItem value="snack">Snack</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Schwierigkeit</Label>
          <Select value={difficulty} onValueChange={(value) => setDifficulty(value as Difficulty)} disabled={isSaving}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Einfach</SelectItem>
              <SelectItem value="medium">Mittel</SelectItem>
              <SelectItem value="hard">Schwer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-4">
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
                onClick={() => handleRemoveTag(tag)}
                className="ml-0.5 text-zinc-500 hover:text-zinc-200"
                disabled={isSaving}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="relative">
          <div className="flex gap-2">
            <Input
              value={tagInput}
              disabled={isSaving}
              placeholder="Tag eingeben..."
              className="bg-background/70"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isSaving || !tagInput.trim()}
              onClick={() => handleAddTag()}
            >
              Hinzufügen
            </Button>
          </div>
          {tagSuggestions.length > 0 && (
            <div className="absolute top-[calc(100%+0.4rem)] left-0 z-20 w-full rounded-lg border border-border/70 bg-popover p-1 shadow-lg">
              {tagSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  onClick={() => handleAddTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-4">
        <Label>Bild</Label>
        {currentImageUrl ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImageUrl}
              alt="Vorschau"
              className="h-32 w-32 rounded-xl object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={isSaving}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="rounded-xl border border-dashed border-border/80 bg-muted/35 p-6 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (isSaving) return
                void handleFileSelect(e.dataTransfer.files?.[0] || null)
              }}
            >
              <UploadCloud className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Bild hierher ziehen</p>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP bis 5MB</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                Bild auswählen
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving || !imageSearchEnabled || isSearchingImage}
                onClick={() => void handleSearchImage()}
              >
                {isSearchingImage ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="mr-2 h-4 w-4" />
                )}
                Bild suchen
              </Button>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            void handleFileSelect(e.target.files?.[0] || null)
            e.currentTarget.value = ''
          }}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Abbrechen
        </Button>
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={
            isSaving ||
            !title.trim() ||
            !ingredientsText.trim() ||
            !instructionsText.trim()
          }
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Speichern
        </Button>
      </div>

      <ImageSelectionModal
        open={isSelectionOpen}
        loading={isLoadingCandidates}
        title={title.trim() || 'Rezept'}
        candidates={imageCandidates}
        onOpenChange={setIsSelectionOpen}
        onSelectCandidate={(candidate) => handleSelectCandidate(candidate)}
        onRefreshSearch={() => void handleSearchImage()}
      />
    </div>
  )
}
