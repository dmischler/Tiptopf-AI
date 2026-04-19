import type { Difficulty, RecipeCategory } from '@/types'

export type StructuredUrlRecipe = {
  title: string
  ingredients: string[]
  instructions: string
  prep_time: number | null
  cook_time: number | null
  servings: number | null
  category: RecipeCategory
  difficulty: Difficulty
  confidence: number
}

type FetchResult = {
  content: string
  imageUrl: string | null
  structuredRecipe: StructuredUrlRecipe | null
}

type JsonLdRecipeNode = {
  ['@type']?: string | string[]
  name?: string
  description?: string
  recipeIngredient?: unknown
  recipeInstructions?: unknown
  prepTime?: unknown
  cookTime?: unknown
  totalTime?: unknown
  recipeYield?: unknown
  recipeCategory?: unknown
  keywords?: unknown
  image?: string | string[] | { url?: string } | Array<{ url?: string }>
}

function normalizeMaybeArray<T>(value: T | T[] | undefined) {
  if (!value) return [] as T[]
  return Array.isArray(value) ? value : [value]
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? normalizeText(item) : ''))
      .filter((item) => item.length > 0)
  }

  if (typeof value === 'string') {
    const normalized = normalizeText(value)
    return normalized ? [normalized] : []
  }

  return [] as string[]
}

function parseDurationToMinutes(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }

  if (typeof value !== 'string') {
    return null
  }

  const raw = value.trim()
  if (!raw) {
    return null
  }

  if (/^\d+$/.test(raw)) {
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  const match = raw.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/i)
  if (!match) {
    return null
  }

  const days = Number(match[1] || 0)
  const hours = Number(match[2] || 0)
  const minutes = Number(match[3] || 0)
  const seconds = Number(match[4] || 0)

  const totalMinutes = days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60)
  return totalMinutes > 0 ? totalMinutes : null
}

function parseServings(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.round(value))
  }

  if (Array.isArray(value)) {
    return parseServings(value[0])
  }

  if (typeof value !== 'string') {
    return null
  }

  const match = value.replace(',', '.').match(/\d+(\.\d+)?/)
  if (!match) {
    return null
  }

  const parsed = Number(match[0])
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.max(1, Math.round(parsed))
}

function inferCategory(text: string): RecipeCategory {
  const value = text.toLowerCase()

  if (/\b(cake|cookie|dessert|sweet|chocolate|ice cream|pudding|tiramisu|pie|brownie)\b/.test(value)) {
    return 'dessert'
  }

  if (/\b(breakfast|brunch|pancake|waffle|granola|omelet|oatmeal|toast)\b/.test(value)) {
    return 'breakfast'
  }

  if (/\b(snack|chips|bar|cracker|dip|smoothie)\b/.test(value)) {
    return 'snack'
  }

  if (/\b(side|side dish|salad|slaw|fries|rice|vegetable)\b/.test(value)) {
    return 'side'
  }

  if (/\b(starter|appetizer|soup|bruschetta|canape)\b/.test(value)) {
    return 'starter'
  }

  return 'main'
}

function inferDifficulty(ingredients: string[], instructions: string, metadataText: string): Difficulty {
  const normalizedMetadata = metadataText.toLowerCase()

  if (/\b(easy|quick|simple|beginner|30-minute|30 minute|one-pot)\b/.test(normalizedMetadata)) {
    return 'easy'
  }

  if (/\b(hard|advanced|complex|challenging)\b/.test(normalizedMetadata)) {
    return 'hard'
  }

  const stepCount = instructions.split(/\n+/).filter((line) => line.trim().length > 0).length
  if (ingredients.length >= 14 || stepCount >= 10) {
    return 'hard'
  }

  if (ingredients.length <= 7 && stepCount <= 5) {
    return 'easy'
  }

  return 'medium'
}

function collectInstructionLines(value: unknown, lines: string[]) {
  if (!value) {
    return
  }

  if (typeof value === 'string') {
    const normalized = normalizeText(value)
    if (normalized) {
      lines.push(normalized)
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectInstructionLines(item, lines))
    return
  }

  if (typeof value !== 'object') {
    return
  }

  const node = value as Record<string, unknown>
  const text = typeof node.text === 'string' ? normalizeText(node.text) : ''
  if (text) {
    lines.push(text)
  }

  if (!text && typeof node.name === 'string') {
    const name = normalizeText(node.name)
    if (name) {
      lines.push(name)
    }
  }

  if ('itemListElement' in node) {
    collectInstructionLines(node.itemListElement, lines)
  }
}

function buildInstructionText(value: unknown) {
  const lines: string[] = []
  collectInstructionLines(value, lines)

  return lines
    .filter((line, index) => index === 0 || line !== lines[index - 1])
    .join('\n')
}

function buildStructuredRecipe(recipe: JsonLdRecipeNode): StructuredUrlRecipe | null {
  const title = typeof recipe.name === 'string' ? normalizeText(recipe.name) : ''
  const ingredients = toStringArray(recipe.recipeIngredient)
  const instructions = buildInstructionText(recipe.recipeInstructions)

  if (!title || ingredients.length === 0 || !instructions) {
    return null
  }

  const prepTime = parseDurationToMinutes(recipe.prepTime)
  const cookTime = parseDurationToMinutes(recipe.cookTime)
  const totalTime = parseDurationToMinutes(recipe.totalTime)
  const servings = parseServings(recipe.recipeYield)

  const categoryText = [
    typeof recipe.recipeCategory === 'string' ? recipe.recipeCategory : '',
    typeof recipe.keywords === 'string' ? recipe.keywords : '',
    title,
    ingredients.join(' '),
  ]
    .join(' ')
    .trim()

  const metadataText = [
    typeof recipe.description === 'string' ? recipe.description : '',
    typeof recipe.keywords === 'string' ? recipe.keywords : '',
  ]
    .join(' ')
    .trim()

  return {
    title,
    ingredients,
    instructions,
    prep_time: prepTime ?? (cookTime === null ? totalTime : null),
    cook_time: cookTime,
    servings,
    category: inferCategory(categoryText),
    difficulty: inferDifficulty(ingredients, instructions, metadataText),
    confidence: 0.92,
  }
}

function buildRecipeContent(recipe: JsonLdRecipeNode, structuredRecipe: StructuredUrlRecipe | null) {
  const ingredients = toStringArray(recipe.recipeIngredient)
  const instructions = buildInstructionText(recipe.recipeInstructions)

  const content = [
    typeof recipe.name === 'string' ? normalizeText(recipe.name) : structuredRecipe?.title,
    typeof recipe.description === 'string' ? normalizeText(recipe.description) : null,
    (ingredients.length ? ingredients : structuredRecipe?.ingredients || []).join('\n'),
    instructions || structuredRecipe?.instructions || '',
    recipe.prepTime ? `Prep: ${String(recipe.prepTime)}` : null,
    recipe.cookTime ? `Cook: ${String(recipe.cookTime)}` : null,
    recipe.recipeYield ? `Servings: ${String(recipe.recipeYield)}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  return content.trim()
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
        const recipe = node as JsonLdRecipeNode

        const type = recipe['@type']
        const types = Array.isArray(type) ? type : type ? [type] : []
        if (!types.some((entry) => entry.toLowerCase() === 'recipe')) continue

        const structuredRecipe = buildStructuredRecipe(recipe)

        const imageCandidates = normalizeMaybeArray(recipe.image)
        const imageCandidate = imageCandidates[0]
        const imageUrl =
          typeof imageCandidate === 'string'
            ? imageCandidate
            : (imageCandidate as { url?: string } | undefined)?.url || null

        const content = buildRecipeContent(recipe, structuredRecipe)
        if (!content && !structuredRecipe) continue

        return {
          content,
          imageUrl,
          structuredRecipe,
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
    structuredRecipe: null,
  }
}
