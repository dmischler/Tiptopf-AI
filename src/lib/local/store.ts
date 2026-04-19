import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'

import { DEFAULT_BASE_URL } from '@/lib/ai/client'
import type { Difficulty, Profile, Recipe, RecipeCategory, RecipeSourceType } from '@/types'

import { getDataDir, getStoreFilePath } from '@/lib/local/paths'

export const LOCAL_PROFILE_ID = 'local-device'
const LOCAL_PROFILE_EMAIL = 'local@tiptopf.local'

type LocalStore = {
  recipes: Recipe[]
  profile: Profile
}

type CreateRecipeInput = {
  title: string
  ingredients: string[]
  instructions: string
  prep_time: number
  cook_time: number
  servings: number
  category: RecipeCategory
  difficulty: Difficulty
  image_url: string | null
  source_url: string | null
  source_type: RecipeSourceType
}

type SaveProfileSettingsInput = {
  encryptedApiKey: string | null
  apiBaseUrl: string
}

let writeQueue: Promise<void> = Promise.resolve()

function nowIso() {
  return new Date().toISOString()
}

function createDefaultProfile(): Profile {
  const now = nowIso()

  return {
    id: LOCAL_PROFILE_ID,
    email: LOCAL_PROFILE_EMAIL,
    encrypted_api_key: null,
    api_base_url: DEFAULT_BASE_URL,
    created_at: now,
    updated_at: now,
  }
}

function createDefaultStore(): LocalStore {
  return {
    recipes: [],
    profile: createDefaultProfile(),
  }
}

async function ensureDataDir() {
  await fs.mkdir(getDataDir(), { recursive: true })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toStringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null
}

function toIsoOrNow(value: unknown) {
  if (typeof value === 'string' && !Number.isNaN(new Date(value).getTime())) {
    return value
  }

  return nowIso()
}

function normalizeCategory(value: unknown): RecipeCategory {
  if (
    value === 'starter' ||
    value === 'main' ||
    value === 'dessert' ||
    value === 'side' ||
    value === 'breakfast' ||
    value === 'snack'
  ) {
    return value
  }

  return 'main'
}

function normalizeDifficulty(value: unknown): Difficulty {
  if (value === 'easy' || value === 'medium' || value === 'hard') {
    return value
  }

  return 'medium'
}

function toPositiveInt(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed))
    }
  }

  return fallback
}

function normalizeSourceType(value: unknown): RecipeSourceType {
  if (value === 'image' || value === 'url' || value === 'manual') {
    return value
  }

  return 'manual'
}

function normalizeRecipe(value: unknown): Recipe | null {
  if (!isObject(value)) {
    return null
  }

  const id = typeof value.id === 'string' && value.id.trim() ? value.id : randomUUID()
  const createdAt = toIsoOrNow(value.created_at)
  const updatedAt = toIsoOrNow(value.updated_at)

  const ingredients = Array.isArray(value.ingredients)
    ? value.ingredients.map((item) => String(item)).filter((item) => item.trim().length > 0)
    : []

  return {
    id,
    user_id: typeof value.user_id === 'string' && value.user_id.trim() ? value.user_id : LOCAL_PROFILE_ID,
    title: typeof value.title === 'string' && value.title.trim() ? value.title : 'Untitled recipe',
    ingredients,
    instructions: typeof value.instructions === 'string' ? value.instructions : '',
    prep_time: toPositiveInt(value.prep_time, 0),
    cook_time: toPositiveInt(value.cook_time, 0),
    servings: Math.max(1, toPositiveInt(value.servings, 1)),
    category: normalizeCategory(value.category),
    difficulty: normalizeDifficulty(value.difficulty),
    rating:
      value.rating === null || value.rating === undefined
        ? null
        : Math.max(0, Math.min(5, Number(value.rating) || 0)),
    is_favorite: Boolean(value.is_favorite),
    image_url: toStringOrNull(value.image_url),
    source_url: toStringOrNull(value.source_url),
    source_type: normalizeSourceType(value.source_type),
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function normalizeProfile(value: unknown): Profile {
  if (!isObject(value)) {
    return createDefaultProfile()
  }

  const base = createDefaultProfile()

  return {
    id: base.id,
    email: base.email,
    encrypted_api_key: toStringOrNull(value.encrypted_api_key),
    api_base_url:
      typeof value.api_base_url === 'string' && value.api_base_url.trim()
        ? value.api_base_url
        : base.api_base_url,
    created_at: toIsoOrNow(value.created_at),
    updated_at: toIsoOrNow(value.updated_at),
  }
}

function normalizeStore(value: unknown): LocalStore {
  if (!isObject(value)) {
    return createDefaultStore()
  }

  const recipes = Array.isArray(value.recipes)
    ? value.recipes.map((item) => normalizeRecipe(item)).filter((item): item is Recipe => Boolean(item))
    : []

  return {
    recipes,
    profile: normalizeProfile(value.profile),
  }
}

async function writeStore(store: LocalStore) {
  await ensureDataDir()
  await fs.writeFile(getStoreFilePath(), JSON.stringify(store, null, 2), 'utf8')
}

async function readStore(): Promise<LocalStore> {
  await ensureDataDir()

  try {
    const raw = await fs.readFile(getStoreFilePath(), 'utf8')
    return normalizeStore(JSON.parse(raw))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const initial = createDefaultStore()
      await writeStore(initial)
      return initial
    }

    throw error
  }
}

async function runMutatingStoreOperation<T>(
  operation: (store: LocalStore) => T | Promise<T>
): Promise<T> {
  const next = writeQueue.then(async () => {
    const store = await readStore()
    const result = await operation(store)
    await writeStore(store)
    return result
  })

  writeQueue = next.then(
    () => undefined,
    () => undefined
  )

  return next
}

export async function listRecipes() {
  const store = await readStore()
  return [...store.recipes]
}

export async function createRecipe(input: CreateRecipeInput) {
  return runMutatingStoreOperation((store) => {
    const now = nowIso()
    const recipe: Recipe = {
      id: randomUUID(),
      user_id: LOCAL_PROFILE_ID,
      title: input.title,
      ingredients: input.ingredients,
      instructions: input.instructions,
      prep_time: input.prep_time,
      cook_time: input.cook_time,
      servings: input.servings,
      category: input.category,
      difficulty: input.difficulty,
      rating: null,
      is_favorite: false,
      image_url: input.image_url,
      source_url: input.source_url,
      source_type: input.source_type,
      created_at: now,
      updated_at: now,
    }

    store.recipes.unshift(recipe)
    return recipe
  })
}

function findRecipeIndex(recipes: Recipe[], recipeId: string) {
  return recipes.findIndex((recipe) => recipe.id === recipeId)
}

export async function updateRecipeImage(recipeId: string, imageUrl: string) {
  return runMutatingStoreOperation((store) => {
    const index = findRecipeIndex(store.recipes, recipeId)
    if (index < 0) {
      throw new Error('Recipe not found')
    }

    const updated: Recipe = {
      ...store.recipes[index],
      image_url: imageUrl,
      updated_at: nowIso(),
    }

    store.recipes[index] = updated
    return updated
  })
}

export async function updateRecipeFavorite(recipeId: string, isFavorite: boolean) {
  return runMutatingStoreOperation((store) => {
    const index = findRecipeIndex(store.recipes, recipeId)
    if (index < 0) {
      return null
    }

    const updated: Recipe = {
      ...store.recipes[index],
      is_favorite: isFavorite,
      updated_at: nowIso(),
    }

    store.recipes[index] = updated
    return updated
  })
}

export async function updateRecipeRating(recipeId: string, rating: number | null) {
  return runMutatingStoreOperation((store) => {
    const index = findRecipeIndex(store.recipes, recipeId)
    if (index < 0) {
      return null
    }

    const updated: Recipe = {
      ...store.recipes[index],
      rating,
      updated_at: nowIso(),
    }

    store.recipes[index] = updated
    return updated
  })
}

export async function getProfile() {
  const store = await readStore()
  return store.profile
}

export async function saveProfileSettings(input: SaveProfileSettingsInput) {
  return runMutatingStoreOperation((store) => {
    const now = nowIso()
    const current = normalizeProfile(store.profile)

    store.profile = {
      ...current,
      id: LOCAL_PROFILE_ID,
      email: LOCAL_PROFILE_EMAIL,
      encrypted_api_key:
        input.encryptedApiKey && input.encryptedApiKey.trim().length > 0
          ? input.encryptedApiKey
          : current.encrypted_api_key,
      api_base_url: input.apiBaseUrl,
      created_at: current.created_at,
      updated_at: now,
    }

    return store.profile
  })
}
