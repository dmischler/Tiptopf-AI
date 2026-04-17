# Phase 4: Add Recipe Flow

**Duration:** ~3 hours  
**Goal:** Floating button, modal with tabs, streaming AI parsing, minimal editing before save, image handling

## Steps

### 4.1 Floating Action Button
Create `src/components/add-recipe/fab.tsx`:
```typescript
'use client'
import { Plus } from 'lucide-react'

export function FloatingAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primaryHover transition-all active:scale-95"
      aria-label="Add recipe"
    >
      <Plus className="w-6 h-6 text-black" />
    </button>
  )
}
```

### 4.2 Add Recipe Modal
Create `src/components/add-recipe/modal.tsx`:
- Use shadcn/ui `Dialog` component
- Two tabs (shadcn/ui `Tabs`): "Upload Image" / "Paste URL"
- State machine: `input` → `parsing` → `preview` → `saving`
- Close on success (recipe saved)

### 4.3 Image Upload Tab
Create `src/components/add-recipe/image-upload.tsx`:
- Drag & drop zone with camera icon
- Camera capture option for mobile (`capture="environment"` attribute)
- File type validation: jpg, png, webp only
- Max size: 10MB (allows for phone photos)
- Convert to base64 for AI extraction
- **Do NOT store** — used for extraction only, discarded after

### 4.4 URL Input Tab
Create `src/components/add-recipe/url-input.tsx`:
- URL input field with paste support
- Validate URL format (must start with http/https)
- "Extract Recipe" button
- Show loading state during URL fetch + AI parse

### 4.5 Streaming Progress UI
Create `src/components/add-recipe/streaming-progress.tsx`:
```typescript
'use client'
import { Loader2 } from 'lucide-react'

type Stage = 'fetching' | 'parsing' | 'structuring' | 'complete' | 'error'

const STAGE_LABELS: Record<Stage, string> = {
  fetching: 'Fetching recipe content...',
  parsing: 'AI is reading the recipe...',
  structuring: 'Structuring ingredients and steps...',
  complete: 'Recipe extracted!',
  error: 'Something went wrong. Please try again.',
}

export function StreamingProgress({ 
  stage, 
  streamText 
}: { 
  stage: Stage
  streamText?: string 
}) {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        {stage !== 'complete' && stage !== 'error' && (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        )}
        <span className="text-foreground">{STAGE_LABELS[stage]}</span>
      </div>
      {streamText && (
        <div className="bg-card rounded-lg p-4 text-sm text-muted font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
          {streamText}
        </div>
      )}
    </div>
  )
}
```

### 4.6 Recipe Preview (with minimal editing)
Create `src/components/add-recipe/preview.tsx`:

**Minimal editing fields (before save only):**
- Title (text input) — editable
- Category (dropdown) — editable
- Difficulty (dropdown) — editable
- Servings (number input) — editable
- Image section:
  - If from URL: shows extracted image (already downloaded to Storage)
  - If from image: shows placeholder (image was discarded)
  - "Replace Image" button — upload a new image
  - "Generate Image" button — placeholder for v2 (shows "Coming soon" toast)
- Ingredients list — **read-only** (no editing in MVP)
- Instructions — **read-only** (no editing in MVP)
- Prep time / Cook time — **read-only**
- Source URL — shown if from URL, read-only

**Actions:**
- "Save to Library" button — saves to Supabase
- "Discard" button — cancels and closes modal

### 4.7 Add Recipe Server Actions
Create `src/app/actions/add-recipe.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const saveRecipeSchema = z.object({
  title: z.string().min(1),
  ingredients: z.array(z.string()),
  instructions: z.string().min(1),
  prepTime: z.number().int().nullable(),
  cookTime: z.number().int().nullable(),
  servings: z.number().int().nullable(),
  category: z.enum(['starter', 'main', 'dessert', 'side', 'breakfast', 'snack']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  imageUrl: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceType: z.enum(['image', 'url']),
})

export async function saveRecipe(input: z.infer<typeof saveRecipeSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      title: input.title,
      ingredients: input.ingredients,
      instructions: input.instructions,
      prep_time: input.prepTime ?? 0,
      cook_time: input.cookTime ?? 0,
      servings: input.servings ?? 1,
      category: input.category,
      difficulty: input.difficulty,
      image_url: input.imageUrl,
      source_url: input.sourceUrl,
      source_type: input.sourceType,
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath('/library')
  return data
}

export async function uploadRecipeImage(
  formData: FormData,
  recipeId: string
): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const file = formData.get('image') as File
  const ext = file.type.split('/')[1] || 'jpg'
  const filePath = `${user.id}/${recipeId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('recipe-images')
    .upload(filePath, file, { upsert: true })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(filePath)
  return urlData.publicUrl
}
```

### 4.8 Extract Recipe Server Action
Create `src/app/actions/extract-recipe.ts`:
```typescript
'use server'
import { extractRecipeFromText } from '@/lib/ai/extractor'
import { fetchRecipeUrl, downloadImageToStorage } from '@/lib/ai/url-fetcher'
import { extractRecipeFromImage } from '@/lib/ai/image-handler'
import { createClient } from '@/lib/supabase/server'
import { decryptApiKey } from '@/lib/crypto'

async function getUserApiKey(): Promise<{ apiKey: string; baseUrl: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('encrypted_api_key, api_base_url')
    .eq('id', user.id)
    .single()

  if (!profile?.encrypted_api_key) throw new Error('No API key configured')

  const apiKey = await decryptApiKey(profile.encrypted_api_key, user.id)
  return { apiKey, baseUrl: profile.api_base_url || 'https://api.opencode.ai/v1' }
}

export async function extractFromUrlAction(url: string) {
  const { apiKey, baseUrl } = await getUserApiKey()
  const { content, imageUrl } = await fetchRecipeUrl(url)
  const recipe = await extractRecipeFromText(content, apiKey, baseUrl)

  // Download URL image to Supabase Storage if found
  let storedImageUrl: string | null = null
  if (imageUrl) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      // Use a temp ID; will update after recipe is saved
      const tempId = crypto.randomUUID()
      storedImageUrl = await downloadImageToStorage(imageUrl, user!.id, tempId)
    } catch {
      // If image download fails, use the original URL as fallback
      storedImageUrl = imageUrl
    }
  }

  return { ...recipe, imageUrl: storedImageUrl, sourceUrl: url, sourceType: 'url' }
}

export async function extractFromImageAction(imageBase64: string) {
  const { apiKey, baseUrl } = await getUserApiKey()
  const recipe = await extractRecipeFromImage(imageBase64, apiKey, baseUrl)
  return { ...recipe, imageUrl: null, sourceType: 'image' }
  // Note: Phone image is NOT stored. User can upload a replacement image later.
}
```

## Components to Create
- `src/components/add-recipe/fab.tsx`
- `src/components/add-recipe/modal.tsx`
- `src/components/add-recipe/image-upload.tsx`
- `src/components/add-recipe/url-input.tsx`
- `src/components/add-recipe/preview.tsx`
- `src/components/add-recipe/streaming-progress.tsx`
- `src/app/actions/add-recipe.ts`
- `src/app/actions/extract-recipe.ts`

## Verification
- [x] FAB added to `/library` and opens modal
- [x] Modal includes image/url tabs and phase states (`input -> parsing -> preview -> saving`)
- [x] Image upload supports file select, drag/drop, and camera capture
- [x] URL extraction wired through server action with staged progress UI
- [x] Preview supports editing title/category/difficulty/servings
- [x] Ingredients/instructions kept read-only in preview
- [x] `Generate Image` placeholder implemented with toast
- [x] `Replace Image` flow implemented and uploads on save
- [x] Save action writes recipe with correct `source_type`
- [x] Build verification passed (`npm run build`)
- [ ] End-to-end manual verification against configured Supabase + AI keys

## Phase 4 Implementation Notes (April 17, 2026)
- Kept implementation intentionally simple: no extra client state library, just local component state.
- Phone images are processed transiently for extraction and never uploaded automatically.
- URL-derived image upload remains in Phase 3 service; manual replacement uploads at save time in Phase 4.
