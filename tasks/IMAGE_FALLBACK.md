# Recipe Image Fallback Feature

> Feature: Automatically find or generate recipe images when none exists.

## Overview

When recipe extraction returns no image (or URL fetch fails), automatically attempt to find a suitable image using a fallback chain:

1. **Try extract from URL** (existing behavior)
2. **Search Pexels API** — search by recipe title + "food"
3. **Fallback to TheMealDB** — search by matching meal name
4. **Fallback to AI generation** — generate from title/ingredients

Plus a manual "Find image" button in the preview for re-triggering.

## Trigger Conditions

- **Auto:** When extraction returns `image_url: null`, automatically run the full chain
- **Manual:** User clicks "Find image" button in preview

## Env Requirements

```bash
# In .env.local
PEXELS_API_KEY=your_pexels_key  # free at pexels.com/api
# AI uses existing OPENAI_API_KEY (no new key needed)
```

## Fallback Chain

```
Extraction returns image_url: null
  → Server: findRecipeImage(title, category, ingredients)
      → Pexels: search "{title} food"
          → Success? return image URLs
          → No results? → TheMealDB: search "{title}"
              → Success? return image URL
              → No results? → AI: generate image
  → Client: show in preview
```

If auto-trigger finds nothing, the manual button allows retry.

---

## Implementation

### New Files

| File | Purpose |
|------|---------|
| `src/lib/ai/image-search.ts` | Pexels API search |
| `src/lib/ai/meal-db.ts` | TheMealDB fallback search |
| `src/lib/ai/image-generator.ts` | AI image generation (DALL-E) |
| `src/components/add-recipe/image-selection-modal.tsx` | UI for selection/retry |

### Modify Files

| File | Changes |
|------|---------|
| `src/app/actions/extract-recipe.ts` | Add `findRecipeImageAction`, wire in auto-chain |
| `src/components/add-recipe/preview.tsx` | Replace placeholder button with handler |
| `src/components/add-recipe/modal.tsx` | Auto-trigger on null image |

---

## Step 1: Pexels API Search

**File:** `src/lib/ai/image-search.ts`

```ts
import { z } from 'zod'

const PEXELS_API_BASE = 'https://api.pexels.com/v1'

const PexelsPhoto = z.object({
  id: z.number(),
  src: z.object({
    large: z.string(),
    medium: z.string(),
    small: z.string(),
  }),
  alt: z.string(),
  photographer: z.string(),
  photographer_url: z.string(),
})

const PexelsSearchResponse = z.object({
  total_results: z.number(),
  page: z.number(),
  per_page: z.number(),
  photos: z.array(PexelsPhoto),
  next_page: z.string().optional(),
})

export type PexelsImage = z.infer<typeof PexelsPhoto>

export async function searchPexels(
  query: string,
  perPage: number = 6
): Promise<PexelsImage[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    throw new Error('PEXELS_API_KEY not configured')
  }

  const url = new URL(`${PEXELS_API_BASE}/search`)
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('orientation', 'landscape')

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`Pexels search failed: ${response.status}`)
  }

  const data = PexelsSearchResponse.parse(await response.json())
  return data.photos
}
```

---

## Step 2: TheMealDB Fallback

**File:** `src/lib/ai/meal-db.ts`

```ts
import { z } from 'zod'

const MEAL_DB_API = 'https://www.themealdb.com/api/json/v1/1'

const MealSummary = z.object({
  idMeal: z.string(),
  strMeal: z.string(),
  strMealThumb: z.string(),
})

const MealSearchResponse = z.object({
  meals: z.array(MealSummary).nullable(),
})

export type MealSummary = z.infer<typeof MealSummary>

export async function searchTheMealDB(query: string): Promise<MealSummary | null> {
  const url = `${MEAL_DB_API}/search.php?s=${encodeURIComponent(query)}`

  const response = await fetch(url)
  if (!response.ok) {
    return null
  }

  const data = MealSearchResponse.parse(await response.json())

  if (!data.meals || data.meals.length === 0) {
    return null
  }

  const meal = data.meals[0]
  return {
    idMeal: meal.idMeal,
    strMeal: meal.strMeal,
    strMealThumb: `${meal.strMealThumb}/preview`,
  }
}
```

---

## Step 3: AI Image Generation

**File:** `src/lib/ai/image-generator.ts`

```ts
import { decryptApiKey } from '@/lib/crypto'
import { DEFAULT_BASE_URL } from '@/lib/ai/client'
import { resolveAiBaseUrl, resolveAiModelId } from '@/lib/ai/client'
import type { RecipeCategory } from '@/types'

export type GeneratedImageResult = {
  imageUrl: string
  b64Json?: string
}

export async function generateRecipeImage(
  title: string,
  category: RecipeCategory,
  ingredients: string[],
  baseUrl?: string
): Promise<GeneratedImageResult> {
  const prompt = buildImagePrompt(title, category, ingredients)

  const response = await fetch(`${baseUrl || DEFAULT_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolveAiModelId(),
      prompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    }),
  })

  if (!response.ok) {
    throw new Error(`Image generation failed: ${response.status}`)
  }

  const data = await response.json()
  return {
    imageUrl: data.data[0].url,
    b64Json: data.data[0].b64_json,
  }
}

function buildImagePrompt(
  title: string,
  category: RecipeCategory,
  ingredients: string[]
): string {
  const categoryWords: Record<RecipeCategory, string> = {
    starter: 'appetizing starter dish',
    main: 'delicious main course',
    dessert: 'beautiful dessert',
    side: 'tasty side dish',
    breakfast: 'mouthwatering breakfast',
    snack: 'Yummy snack',
  }

  const categoryDesc = categoryWords[category] || 'food dish'

  return `A professionally photographed ${categoryDesc} called "${title}", made with fresh ingredients, beautiful food photography, natural lighting, on a nice plate, top-down or 45-degree angle view, restaurant quality`
}
```

---

## Step 4: Server Action

**File:** `src/app/actions/extract-recipe.ts`

Add import and new action:

```ts
import { searchPexels } from '@/lib/ai/image-search'
import { searchTheMealDB } from '@/lib/ai/meal-db'
import { generateRecipeImage } from '@/lib/ai/image-generator'
import { getProfile, LOCAL_PROFILE_ID } from '@/lib/local/store'
import { downloadImageToLocalStorage } from '@/lib/local/images'

// ... existing getUserApiConfig ...

export async function findRecipeImageAction(
  title: string,
  category: RecipeCategory,
  ingredients: string[]
): Promise<string | null> {
  // Try Pexels first
  try {
    const photos = await searchPexels(`${title} recipe food`)
    if (photos.length > 0) {
      const photo = photos[0]
      const stored = await downloadImageToLocalStorage(
        photo.src.large,
        crypto.randomUUID()
      )
      if (stored) return stored
    }
  } catch {
    // Continue to next fallback
  }

  // Try TheMealDB
  try {
    const meal = await searchTheMealDB(title)
    if (meal) {
      const stored = await downloadImageToLocalStorage(
        meal.strMealThumb,
        crypto.randomUUID()
      )
      if (stored) return stored
    }
  } catch {
    // Continue to next fallback
  }

  // Fallback to AI generation
  try {
    const profile = await getProfile()
    if (!profile?.encrypted_api_key) {
      return null
    }

    const apiKey = await decryptApiKey(profile.encrypted_api_key, LOCAL_PROFILE_ID)
    const baseUrl = profile.api_base_url || DEFAULT_BASE_URL

    const result = await generateRecipeImage(title, category, ingredients, baseUrl)

    if (result.b64Json) {
      const bytes = Uint8Array.from(atob(result.b64Json), (c) => c.charCodeAt(0))
      const stored = await downloadImageToLocalStorageFromBytes(
        bytes,
        crypto.randomUUID()
      )
      return stored
    }

    if (result.imageUrl) {
      return downloadImageToLocalStorage(result.imageUrl, crypto.randomUUID())
    }
  } catch {
    return null
  }

  return null
}
```

---

## Step 5: Wire Auto-Trigger in Modal

**File:** `src/components/add-recipe/modal.tsx`

In `handleExtractFromUrl`, after receiving recipe:

```ts
// If no image was found, auto-trigger the fallback chain
if (!recipe.image_url) {
  setProgressStage('finding_image')
  setStreamText('Finding a matching image...')

  try {
    const imageUrl = await findRecipeImageAction(
      recipe.title,
      recipe.category,
      recipe.ingredients
    )
    if (imageUrl) {
      setExtractedRecipe({ ...recipe, image_url: imageUrl })
      setPreviewState(buildEditableState({ ...recipe, image_url: imageUrl }))
    }
  } catch {
    // Silent failure, user can manually retry
  }
}
```

---

## Step 6: Wire Button in Preview

**File:** `src/components/add-recipe/preview.tsx`

Replace the placeholder button handler:

```ts
import { findRecipeImageAction } from '@/app/actions/extract-recipe'

// In component:
const [isFindingImage, setIsFindingImage] = useState(false)

async function handleFindImage() {
  if (!parsedRecipe?.title || isFindingImage) return

  setIsFindingImage(true)
  try {
    const imageUrl = await findRecipeImageAction(
      parsedRecipe.title,
      parsedRecipe.category,
      parsedRecipe.ingredients
    )
    if (imageUrl) {
      update({ imageUrl })
      toast.success('Image found!')
    } else {
      toast.error('Could not find an image. Try again later.')
    }
  } catch {
    toast.error('Failed to find image.')
  } finally {
    setIsFindingImage(false)
  }
}

// Button in JSX:
<Button
  type="button"
  variant="outline"
  onClick={handleFindImage}
  disabled={disabled || isFindingImage}
>
  {isFindingImage ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <ImageIcon className="h-4 w-4" />
  )}
  Find image
</Button>
```

---

## Step 7: Image Selection Modal (Optional Enhancement)

For manual selection from Pexels results (if more than 1 option):

**File:** `src/components/add-recipe/image-selection-modal.tsx`

```ts
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { searchPexels } from '@/app/actions/extract-recipe'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type ImageSelectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onSelect: (imageUrl: string) => void
  onGenerateAi?: () => void
}

export function ImageSelectionModal({
  open,
  onOpenChange,
  title,
  onSelect,
  onGenerateAi,
}: ImageSelectionModalProps) {
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (open && title) {
      setLoading(true)
      searchPexelsForSelection(`${title} food recipe`)
        .then(setImages)
        .finally(() => setLoading(false))
    }
  }, [open, title])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select an image</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Searching Pexels...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {images.map((url) => (
              <button
                key={url}
                onClick={() => setSelected(url)}
                className={`relative aspect-video overflow-hidden rounded-lg border-2 ${
                  selected === url ? 'border-primary' : 'border-transparent'
                }`}
              >
                <Image src={url} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-between">
          {onGenerateAi && (
            <Button variant="outline" onClick={onGenerateAi}>
              Generate with AI
            </Button>
          )}
          <Button onClick={() => selected && onSelect(selected)} disabled={!selected}>
            Use this image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Testing

1. **Pexels-only test:** Add test key, extract from URL with no image
2. **Full chain test:** Block Pexels, verify TheMealDB fallback
3. **AI fallback test:** Disable both APIs, verify AI generation
4. **Manual button test:** Click button after extraction

---

## Verification

```bash
npm run build
npm run lint
```

---

## Notes

- Pexels API requires attribution — add "Photo by X on Pexels" somewhere
- TheMealDB uses test key `1` with no limits
- AI generation uses existing API key, no new config needed
- If all fallbacks fail, show placeholder and button retry