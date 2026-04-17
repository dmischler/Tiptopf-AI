# Phase 3: AI Service Layer

**Duration:** ~2 hours  
**Goal:** OpenCode Go integration with streaming, URL/image parsing

## Steps

### 3.1 AI Client Setup
Create `src/lib/ai/client.ts`:
```typescript
import { createOpenAI } from '@ai-sdk/openai'

export function createAiClient(apiKey: string, baseUrl?: string) {
  return createOpenAI({
    apiKey,
    baseURL: baseUrl || 'https://api.opencode.ai/v1'
  })
}
```

> **Note:** The model identifier will need to be verified against the OpenCode Go endpoint. Current assumption: `MiniMax-M2.7` or similar. Test with a simple prompt first and adjust.

### 3.2 Recipe Parsing Prompt
Create `src/lib/ai/prompts.ts`:
```typescript
export const RECIPE_SYSTEM_PROMPT = `You are a recipe extraction expert. Parse the provided recipe content and extract structured information.

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "title": "string — the recipe name",
  "ingredients": ["string — one ingredient per item, include quantities"],
  "instructions": "string — numbered steps, separated by newlines",
  "prepTime": number | null — preparation time in minutes,
  "cookTime": number | null — cooking time in minutes,
  "servings": number | null — number of servings,
  "category": "starter" | "main" | "dessert" | "side" | "breakfast" | "snack",
  "difficulty": "easy" | "medium" | "hard",
  "confidence": number — 0 to 1, how confident you are in the extraction
}

Rules:
- If a field cannot be determined, use null (except title and category which are required)
- Ingredients should include quantities and units (e.g. "2 cups flour")
- Instructions should be clear numbered steps
- Category must be exactly one of: starter, main, dessert, side, breakfast, snack
- Difficulty defaults to "medium" if unclear
- Keep the original language of the recipe (do not translate)`

export const IMAGE_EXTRACTION_PROMPT = `${RECIPE_SYSTEM_PROMPT}

The following content was extracted from a photo of a recipe. It may contain OCR errors — use context to fix obvious mistakes.`

export const URL_EXTRACTION_PROMPT = `${RECIPE_SYSTEM_PROMPT}

The following content was extracted from a recipe webpage. Focus on the main recipe content, ignoring navigation, ads, and sidebars.`
```

### 3.3 Recipe Extractor (Streaming)
Create `src/lib/ai/extractor.ts`:
```typescript
'use server'
import { streamText } from 'ai'
import { createAiClient } from './client'
import { IMAGE_EXTRACTION_PROMPT, URL_EXTRACTION_PROMPT } from './prompts'
import type { ParsedRecipe } from '@/types'
import { z } from 'zod'

const recipeSchema = z.object({
  title: z.string(),
  ingredients: z.array(z.string()),
  instructions: z.string(),
  prepTime: z.number().nullable(),
  cookTime: z.number().nullable(),
  servings: z.number().nullable(),
  category: z.enum(['starter', 'main', 'dessert', 'side', 'breakfast', 'snack']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  confidence: z.number().min(0).max(1),
})

export async function extractRecipeFromText(
  text: string,
  apiKey: string,
  baseUrl?: string
): Promise<ParsedRecipe> {
  const ai = createAiClient(apiKey, baseUrl)
  
  const result = await streamText({
    model: ai('MiniMax-M2.7'),
    system: IMAGE_EXTRACTION_PROMPT,
    prompt: text,
  })

  let fullText = ''
  for await (const chunk of result.textStream) {
    fullText += chunk
  }

  // Parse the JSON response (strip markdown fences if present)
  const jsonStr = fullText.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
  const parsed = JSON.parse(jsonStr)
  return recipeSchema.parse(parsed)
}

export async function streamRecipeExtraction(
  text: string,
  apiKey: string,
  baseUrl?: string,
  isUrl = false
) {
  const ai = createAiClient(apiKey, baseUrl)
  
  const result = streamText({
    model: ai('MiniMax-M2.7'),
    system: isUrl ? URL_EXTRACTION_PROMPT : IMAGE_EXTRACTION_PROMPT,
    prompt: text,
  })

  return result.toTextStreamResponse()
}
```

> **Important:** The model identifier `'MiniMax-M2.7'` must match exactly what the OpenCode Go endpoint accepts. Test this first and adjust if needed. Common patterns might be `minimax/m2.7`, `MiniMax-M2.7`, etc.

### 3.4 URL Fetcher
Create `src/lib/ai/url-fetcher.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'

interface FetchResult {
  content: string
  imageUrl: string | null
}

export async function fetchRecipeUrl(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ReciPin/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`)
  }

  const html = await response.text()

  // Extract JSON-LD recipe data if available (many recipe sites use schema.org)
  const jsonLdMatch = html.match(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  )

  let recipeContent = ''
  let extractedImageUrl: string | null = null

  // Try JSON-LD first (most reliable)
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      try {
        const jsonStr = match.replace(/<\/?script[^>]*>/gi, '')
        const data = JSON.parse(jsonStr)
        // Handle both single objects and @graph arrays
        const recipes = Array.isArray(data) ? data : [data]
        for (const item of recipes) {
          if (item['@type'] === 'Recipe' || (item['@graph'] && item['@graph'].some((g: any) => g['@type'] === 'Recipe'))) {
            const recipe = item['@type'] === 'Recipe' ? item : item['@graph'].find((g: any) => g['@type'] === 'Recipe')
            recipeContent = [
              recipe.name,
              recipe.description,
              Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient.join('\n') : '',
              Array.isArray(recipe.recipeInstructions)
                ? recipe.recipeInstructions.map((s: any) => s.text || s).join('\n')
                : recipe.recipeInstructions,
              `Prep: ${recipe.prepTime}`,
              `Cook: ${recipe.cookTime}`,
              `Servings: ${recipe.recipeYield}`,
            ].filter(Boolean).join('\n\n')
            extractedImageUrl = recipe.image
            break
          }
        }
      } catch {}
    }
  }

  // Fallback: extract text from HTML body
  if (!recipeContent) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const bodyText = bodyMatch ? bodyMatch[1] : html
    // Strip tags, decode entities, clean whitespace
    recipeContent = bodyText
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Try to find og:image or main image from HTML head
  if (!extractedImageUrl) {
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
    extractedImageUrl = ogImage ? ogImage[1] : null
  }

  return { content: recipeContent, imageUrl: extractedImageUrl }
}

/**
 * Download an external image and upload to Supabase Storage.
 * Returns the public Supabase Storage URL.
 */
export async function downloadImageToStorage(
  imageUrl: string,
  userId: string,
  recipeId: string
): Promise<string> {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`)

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const buffer = await response.arrayBuffer()
  const filePath = `${userId}/${recipeId}.${ext}`

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('recipe-images')
    .upload(filePath, buffer, {
      contentType,
      upsert: true,
    })

  if (error) throw error

  const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(filePath)
  return urlData.publicUrl
}
```

### 3.5 Image Handling (Phone Photos)
Create `src/lib/ai/image-handler.ts`:
```typescript
'use server'
import { createAiClient } from './client'
import { streamText } from 'ai'
import { IMAGE_EXTRACTION_PROMPT } from './prompts'

/**
 * Process an uploaded phone image.
 * The image is sent directly to the AI model for vision/multimodal extraction.
 * The original image is NOT stored long-term (per VISION.md rule).
 */
export async function extractRecipeFromImage(
  imageBase64: string,
  apiKey: string,
  baseUrl?: string
) {
  const ai = createAiClient(apiKey, baseUrl)

  const result = await streamText({
    model: ai('MiniMax-M2.7'),
    system: IMAGE_EXTRACTION_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: imageBase64 },
          { type: 'text', text: 'Extract the recipe from this image. Return JSON only.' },
        ],
      },
    ],
  })

  let fullText = ''
  for await (const chunk of result.textStream) {
    fullText += chunk
  }

  const jsonStr = fullText.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(jsonStr)
}
```

> **Image handling rules (from VISION.md):**
> - Phone image: temporary only, used for extraction, then discarded — never stored long-term
> - URL recipes: automatically extract the main recipe photo and download it to Supabase Storage
> - Fallback: user can upload a replacement image or click "Generate Image" (placeholder)

## Files to Create
- `src/lib/ai/client.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/ai/extractor.ts`
- `src/lib/ai/url-fetcher.ts`
- `src/lib/ai/image-handler.ts`
- `src/app/actions/extract-recipe.ts` (server action wrapping above)

## Verification
- [x] Implemented AI service files and extract actions (`src/lib/ai/*`, `src/app/actions/extract-recipe.ts`)
- [x] Implemented URL fetcher with JSON-LD first and HTML fallback
- [x] Implemented URL image download to Supabase storage helper
- [x] Implemented image extraction path (image used transiently, not stored)
- [x] Build verification passed (`npm run build`)
- [ ] Live API verification against OpenCode endpoint (model id + key required)
- [ ] End-to-end extraction verification with real URL/image input in browser

## Phase 3 Implementation Notes (April 17, 2026)
- Added `OPENCODE_MODEL_ID` override support while defaulting to `MiniMax-M2.7`.
- Kept extraction outputs normalized to existing `ParsedRecipe` shape.
- Added a temporary `as any` cast for `streamText` model typing due to upstream package type mismatch in current dependency versions.
