import { createClient } from '@/lib/supabase/server'

type FetchResult = {
  content: string
  imageUrl: string | null
}

function normalizeMaybeArray<T>(value: T | T[] | undefined) {
  if (!value) return [] as T[]
  return Array.isArray(value) ? value : [value]
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function extractRecipeFromJsonLd(html: string): FetchResult | null {
  const scriptMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  if (!scriptMatches) return null

  for (const script of scriptMatches) {
    const rawJson = script.replace(/<\/?script[^>]*>/gi, '').trim()
    const parsed = safeJsonParse(rawJson)
    if (!parsed) continue

    const roots = normalizeMaybeArray(parsed)

    for (const root of roots) {
      const graph = Array.isArray((root as { ['@graph']?: unknown[] })['@graph'])
        ? ((root as { ['@graph']?: unknown[] })['@graph'] as unknown[])
        : []

      const candidates = [root, ...graph]

      for (const node of candidates) {
        const recipe = node as {
          ['@type']?: string | string[]
          name?: string
          description?: string
          recipeIngredient?: string[]
          recipeInstructions?: Array<{ text?: string } | string> | string
          prepTime?: string
          cookTime?: string
          recipeYield?: string
          image?: string | string[] | { url?: string } | Array<{ url?: string }>
        }

        const type = recipe['@type']
        const types = Array.isArray(type) ? type : type ? [type] : []
        if (!types.includes('Recipe')) continue

        const instructions = Array.isArray(recipe.recipeInstructions)
          ? recipe.recipeInstructions
              .map((step) => (typeof step === 'string' ? step : step.text || ''))
              .filter(Boolean)
              .join('\n')
          : recipe.recipeInstructions || ''

        const imageCandidates = normalizeMaybeArray(recipe.image)
        const imageCandidate = imageCandidates[0]
        const imageUrl =
          typeof imageCandidate === 'string'
            ? imageCandidate
            : (imageCandidate as { url?: string } | undefined)?.url || null

        const content = [
          recipe.name,
          recipe.description,
          recipe.recipeIngredient?.join('\n'),
          instructions,
          recipe.prepTime ? `Prep: ${recipe.prepTime}` : null,
          recipe.cookTime ? `Cook: ${recipe.cookTime}` : null,
          recipe.recipeYield ? `Servings: ${recipe.recipeYield}` : null,
        ]
          .filter(Boolean)
          .join('\n\n')

        if (!content) continue

        return {
          content,
          imageUrl,
        }
      }
    }
  }

  return null
}

function extractPlainTextFallback(html: string) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const source = bodyMatch ? bodyMatch[1] : html

  return source
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractOgImage(html: string) {
  const match = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
  return match ? match[1] : null
}

export async function fetchRecipeUrl(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Tiptopf-AI/1.0)',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`)
  }

  const html = await response.text()
  const jsonLdResult = extractRecipeFromJsonLd(html)

  if (jsonLdResult) {
    return jsonLdResult
  }

  return {
    content: extractPlainTextFallback(html),
    imageUrl: extractOgImage(html),
  }
}

export async function downloadImageToStorage(
  imageUrl: string,
  userId: string,
  recipeId: string
): Promise<string> {
  const response = await fetch(imageUrl, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const filePath = `${userId}/${recipeId}.${ext}`
  const buffer = await response.arrayBuffer()

  const supabase = await createClient()
  const { error } = await supabase.storage.from('recipe-images').upload(filePath, buffer, {
    contentType,
    upsert: true,
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from('recipe-images').getPublicUrl(filePath)
  return data.publicUrl
}
