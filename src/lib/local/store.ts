import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type {
  AppSettings,
  Collection,
  Difficulty,
  Profile,
  Recipe,
  RecipeCategory,
  RecipeSourceType,
  ShoppingListItem,
} from '@/types'

import { writeFileDurable } from '@/lib/local/durable-write'
import { StoreCorruptError } from '@/lib/local/errors'
import { getStoreFilePath } from '@/lib/local/paths'
import { normalizeTags } from '@/lib/utils'
import { reorderShoppingList } from '@/lib/shopping'

export const LOCAL_PROFILE_ID = 'local-device'
const LOCAL_PROFILE_EMAIL = 'local@tiptopf.local'

type LocalStore = {
  recipes: Recipe[]
  collections: Collection[]
  shoppingList: ShoppingListItem[]
  profile: Profile
  settings: AppSettings
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
  tags?: string[]
  notes?: string
}

type UpdateRecipeInput = Partial<
  Omit<
    Recipe,
    'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating' | 'is_favorite' | 'image_url'
  >
>

let writeQueue: Promise<void> = Promise.resolve()
// Prevents first-boot ENOENT from re-entering the queue while a mutation is running.
let mutationRunning = false

function nowIso() {
  return new Date().toISOString()
}

function createDefaultProfile(): Profile {
  const now = nowIso()

  return {
    id: LOCAL_PROFILE_ID,
    email: LOCAL_PROFILE_EMAIL,
    created_at: now,
    updated_at: now,
  }
}

function createDefaultSettings(): AppSettings {
  return {
    opencode_api_key: null,
    opencode_base_url: null,
    opencode_model_id: null,
    gemini_api_key: null,
    gemini_base_url: null,
    gemini_model_id: null,
    gemini_fallback_model_id: null,
    pexels_api_key: null,
  }
}

function createDefaultStore(): LocalStore {
  return {
    recipes: [],
    collections: [],
    shoppingList: [],
    profile: createDefaultProfile(),
    settings: createDefaultSettings(),
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toStringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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

  if (typeof value.id !== 'string' || !value.id.trim()) {
    console.error('Skipping recipe with missing id')
    return null
  }

  const id = value.id
  const createdAt = toIsoOrNow(value.created_at)
  const updatedAt = toIsoOrNow(value.updated_at)

  const ingredients = Array.isArray(value.ingredients)
    ? value.ingredients.map((item) => String(item)).filter((item) => item.trim().length > 0)
    : []

  const tags = normalizeTags(value.tags)

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
    tags,
    notes: typeof value.notes === 'string' ? value.notes : '',
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
    created_at: toIsoOrNow(value.created_at),
    updated_at: toIsoOrNow(value.updated_at),
  }
}

function normalizeSettings(value: unknown): AppSettings {
  const base = createDefaultSettings()

  if (!isObject(value)) {
    return base
  }

  return {
    opencode_api_key: normalizeOptionalString(value.opencode_api_key),
    opencode_base_url: normalizeOptionalString(value.opencode_base_url),
    opencode_model_id: normalizeOptionalString(value.opencode_model_id),
    gemini_api_key: normalizeOptionalString(value.gemini_api_key),
    gemini_base_url: normalizeOptionalString(value.gemini_base_url),
    gemini_model_id:
      normalizeOptionalString(value.gemini_model_id) ||
      normalizeOptionalString(value.gemini_image_model_id),
    gemini_fallback_model_id:
      normalizeOptionalString(value.gemini_fallback_model_id) ||
      normalizeOptionalString(value.gemini_image_fallback_model_id),
    pexels_api_key: normalizeOptionalString(value.pexels_api_key),
  }
}

function normalizeCollection(value: unknown): Collection | null {
  if (!isObject(value)) {
    return null
  }

  if (typeof value.id !== 'string' || !value.id.trim()) {
    console.error('Skipping collection with missing id')
    return null
  }

  const id = value.id
  const createdAt = toIsoOrNow(value.created_at)
  const updatedAt = toIsoOrNow(value.updated_at)

  const recipeIds = Array.isArray(value.recipe_ids)
    ? value.recipe_ids.map((item) => String(item)).filter((item) => item.trim().length > 0)
    : []

  return {
    id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Unnamed Collection',
    recipe_ids: recipeIds,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function normalizeShoppingListItem(value: unknown): ShoppingListItem | null {
  if (!isObject(value)) {
    return null
  }

  if (typeof value.id !== 'string' || !value.id.trim()) {
    console.error('Skipping shopping list item with missing id')
    return null
  }

  const id = value.id
  const addedAt = toIsoOrNow(value.addedAt ?? value.added_at)

  const text = typeof value.text === 'string' ? value.text.trim() : ''
  if (!text) return null

  return {
    id,
    text,
    checked: Boolean(value.checked),
    sourceRecipeTitle: normalizeOptionalString(value.sourceRecipeTitle ?? value.source_recipe_title) ?? undefined,
    sourceServings:
      typeof value.sourceServings === 'number' && Number.isFinite(value.sourceServings) && value.sourceServings > 0
        ? Math.trunc(value.sourceServings)
        : typeof value.source_servings === 'number' && Number.isFinite(value.source_servings) && value.source_servings > 0
          ? Math.trunc(value.source_servings)
          : undefined,
    addedAt,
  }
}

function normalizeStore(value: unknown): LocalStore {
  if (!isObject(value)) {
    return createDefaultStore()
  }

  const recipes = Array.isArray(value.recipes)
    ? value.recipes.map((item) => normalizeRecipe(item)).filter((item): item is Recipe => Boolean(item))
    : []

  const collections = Array.isArray(value.collections)
    ? value.collections.map((item) => normalizeCollection(item)).filter((item): item is Collection => Boolean(item))
    : []

  const shoppingList = Array.isArray(value.shoppingList)
    ? value.shoppingList.map((item) => normalizeShoppingListItem(item)).filter((item): item is ShoppingListItem => Boolean(item))
    : []

  return {
    recipes,
    collections,
    shoppingList,
    profile: normalizeProfile(value.profile),
    settings: normalizeSettings(value.settings),
  }
}

function isEnoent(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

async function listCorruptStorePaths(storePath: string): Promise<string[]> {
  const directory = path.dirname(storePath)
  const prefix = `${path.basename(storePath)}.corrupt.`

  try {
    const entries = await fs.readdir(directory)
    return entries
      .filter((name) => name.startsWith(prefix))
      .map((name) => path.join(directory, name))
      .sort()
  } catch {
    return []
  }
}

async function getExistingBakPath(storePath: string): Promise<string | undefined> {
  const bakPath = `${storePath}.bak`
  try {
    await fs.access(bakPath)
    return bakPath
  } catch {
    return undefined
  }
}

async function quarantineCorruptStore(storePath: string): Promise<string | undefined> {
  const dest = `${storePath}.corrupt.${new Date().toISOString()}`

  try {
    await fs.rename(storePath, dest)
    console.error('Store file is corrupt; quarantined to', dest)
    return dest
  } catch (renameError) {
    try {
      await fs.copyFile(storePath, dest)
      console.error('Store file is corrupt; copied to', dest, '(rename failed)', renameError)
      return dest
    } catch (copyError) {
      console.error('Store file is corrupt; quarantine failed', copyError)
      return undefined
    }
  }
}

async function throwCorruptStore(storePath: string, cause?: unknown): Promise<never> {
  const backupPath = await quarantineCorruptStore(storePath)
  throw new StoreCorruptError(backupPath, cause ? { cause } : undefined)
}

async function parseLiveStore(raw: string, storePath: string): Promise<LocalStore> {
  if (!raw.trim()) {
    await throwCorruptStore(storePath)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    if (error instanceof SyntaxError) {
      await throwCorruptStore(storePath, error)
    }
    throw error
  }

  if (!isObject(parsed) || !Array.isArray(parsed.recipes)) {
    await throwCorruptStore(storePath)
  }

  return normalizeStore(parsed)
}

async function snapshotLastGoodStore(targetPath: string) {
  let raw: string
  try {
    raw = await fs.readFile(targetPath, 'utf8')
  } catch {
    return
  }

  if (!raw.trim()) {
    return
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed) || !Array.isArray(parsed.recipes)) {
      return
    }
  } catch {
    return
  }

  await writeFileDurable(`${targetPath}.bak`, raw)
}

async function writeStore(store: LocalStore) {
  const targetPath = getStoreFilePath()
  await snapshotLastGoodStore(targetPath)
  await writeFileDurable(targetPath, JSON.stringify(store, null, 2))
}

async function ensureStoreExists(): Promise<LocalStore> {
  return runMutatingStoreOperation((store) => store)
}

async function handleMissingStore(storePath: string): Promise<LocalStore> {
  const bakPath = await getExistingBakPath(storePath)
  const corruptPaths = await listCorruptStorePaths(storePath)

  if (bakPath || corruptPaths.length > 0) {
    throw new StoreCorruptError(bakPath ?? corruptPaths[corruptPaths.length - 1])
  }

  if (mutationRunning) {
    return createDefaultStore()
  }

  return ensureStoreExists()
}

async function readStore(): Promise<LocalStore> {
  const storePath = getStoreFilePath()

  try {
    const raw = await fs.readFile(storePath, 'utf8')
    return parseLiveStore(raw, storePath)
  } catch (error) {
    if (error instanceof StoreCorruptError) {
      throw error
    }

    if (isEnoent(error)) {
      return handleMissingStore(storePath)
    }

    throw error
  }
}

async function runMutatingStoreOperation<T>(
  operation: (store: LocalStore) => T | Promise<T>
): Promise<T> {
  const next = writeQueue.then(async () => {
    mutationRunning = true
    try {
      const store = await readStore()
      const result = await operation(store)
      await writeStore(store)
      return result
    } finally {
      mutationRunning = false
    }
  })

  writeQueue = next.then(
    () => undefined,
    (error: unknown) => {
      console.error('Store mutation failed:', error)
    }
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
      tags: normalizeTags(input.tags),
      notes: input.notes ?? '',
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

export async function updateRecipe(recipeId: string, input: UpdateRecipeInput) {
  return runMutatingStoreOperation((store) => {
    const index = findRecipeIndex(store.recipes, recipeId)
    if (index < 0) {
      throw new Error('Recipe not found')
    }

    const updated: Recipe = {
      ...store.recipes[index],
      ...input,
      updated_at: nowIso(),
    }

    store.recipes[index] = updated
    return updated
  })
}

export async function deleteRecipe(recipeId: string) {
  return runMutatingStoreOperation((store) => {
    const index = findRecipeIndex(store.recipes, recipeId)
    if (index < 0) {
      throw new Error('Recipe not found')
    }

    const [removed] = store.recipes.splice(index, 1)
    return removed
  })
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

export async function getSettings() {
  const store = await readStore()
  return { ...store.settings }
}

export async function updateSettings(input: Partial<AppSettings> & Record<string, unknown>) {
  return runMutatingStoreOperation((store) => {
    const next = { ...store.settings }

    if ('opencode_api_key' in input) {
      next.opencode_api_key = normalizeOptionalString(input.opencode_api_key)
    }

    if ('opencode_base_url' in input) {
      next.opencode_base_url = normalizeOptionalString(input.opencode_base_url)
    }

    if ('opencode_model_id' in input) {
      next.opencode_model_id = normalizeOptionalString(input.opencode_model_id)
    }

    if ('gemini_api_key' in input) {
      next.gemini_api_key = normalizeOptionalString(input.gemini_api_key)
    }

    if ('gemini_base_url' in input) {
      next.gemini_base_url = normalizeOptionalString(input.gemini_base_url)
    }

    // Support both old (gemini_image_*) and new unified field names during transition
    if ('gemini_model_id' in input || 'gemini_image_model_id' in input) {
      const newVal = ('gemini_model_id' in input ? input.gemini_model_id : (input as any).gemini_image_model_id) as string | null | undefined
      next.gemini_model_id = normalizeOptionalString(newVal)
    }

    if ('gemini_fallback_model_id' in input || 'gemini_image_fallback_model_id' in input) {
      const newVal = ('gemini_fallback_model_id' in input ? input.gemini_fallback_model_id : (input as any).gemini_image_fallback_model_id) as string | null | undefined
      next.gemini_fallback_model_id = normalizeOptionalString(newVal)
    }

    if ('pexels_api_key' in input) {
      next.pexels_api_key = normalizeOptionalString(input.pexels_api_key)
    }

    store.settings = next
    return { ...next }
  })
}

// Collections

export async function listCollections() {
  const store = await readStore()
  return [...store.collections]
}

export async function getCollection(collectionId: string) {
  const store = await readStore()
  return store.collections.find((c) => c.id === collectionId) ?? null
}

export async function createCollection(name: string) {
  return runMutatingStoreOperation((store) => {
    const now = nowIso()
    const collection: Collection = {
      id: randomUUID(),
      name: name.trim(),
      recipe_ids: [],
      created_at: now,
      updated_at: now,
    }

    store.collections.unshift(collection)
    return collection
  })
}

export async function updateCollection(collectionId: string, name: string) {
  return runMutatingStoreOperation((store) => {
    const index = store.collections.findIndex((c) => c.id === collectionId)
    if (index < 0) {
      throw new Error('Collection not found')
    }

    const updated: Collection = {
      ...store.collections[index],
      name: name.trim(),
      updated_at: nowIso(),
    }

    store.collections[index] = updated
    return updated
  })
}

export async function deleteCollection(collectionId: string) {
  return runMutatingStoreOperation((store) => {
    const index = store.collections.findIndex((c) => c.id === collectionId)
    if (index < 0) {
      throw new Error('Collection not found')
    }

    const [removed] = store.collections.splice(index, 1)
    return removed
  })
}

export async function addRecipeToCollection(collectionId: string, recipeId: string) {
  return runMutatingStoreOperation((store) => {
    const index = store.collections.findIndex((c) => c.id === collectionId)
    if (index < 0) {
      throw new Error('Collection not found')
    }

    const collection = store.collections[index]
    if (collection.recipe_ids.includes(recipeId)) {
      return collection
    }

    const updated: Collection = {
      ...collection,
      recipe_ids: [...collection.recipe_ids, recipeId],
      updated_at: nowIso(),
    }

    store.collections[index] = updated
    return updated
  })
}

export async function exportStoreJson(): Promise<string> {
  const store = await readStore()
  return JSON.stringify(store, null, 2)
}

function assertImportShape(value: unknown): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error('Ungültiges Store-Format.')
  }

  if (!Array.isArray(value.recipes) || !Array.isArray(value.collections)) {
    throw new Error('Store muss Rezepte und Sammlungen enthalten.')
  }
}

export async function importStoreJson(raw: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Ungültiges JSON Format.')
  }

  assertImportShape(parsed)
  const incoming = normalizeStore(parsed)

  return runMutatingStoreOperation((store) => {
    store.recipes = incoming.recipes
    store.collections = incoming.collections
    store.shoppingList = incoming.shoppingList
    store.settings = incoming.settings
    store.profile = incoming.profile
  })
}

export async function removeRecipeFromCollection(collectionId: string, recipeId: string) {
  return runMutatingStoreOperation((store) => {
    const index = store.collections.findIndex((c) => c.id === collectionId)
    if (index < 0) {
      throw new Error('Collection not found')
    }

    const collection = store.collections[index]
    const updated: Collection = {
      ...collection,
      recipe_ids: collection.recipe_ids.filter((id) => id !== recipeId),
      updated_at: nowIso(),
    }

    store.collections[index] = updated
    return updated
  })
}

// Shopping List

export async function getShoppingList() {
  const store = await readStore()
  return [...store.shoppingList]
}

export async function addToShoppingList(
  items: Array<{
    text: string
    sourceRecipeTitle?: string
    sourceServings?: number
  }>,
) {
  if (items.length === 0) {
    return getShoppingList()
  }

  return runMutatingStoreOperation((store) => {
    const now = nowIso()
    const newItems: ShoppingListItem[] = items.map((item) => ({
      id: randomUUID(),
      text: item.text.trim(),
      checked: false,
      sourceRecipeTitle: item.sourceRecipeTitle?.trim() || undefined,
      sourceServings: item.sourceServings,
      addedAt: now,
    }))

    store.shoppingList = reorderShoppingList([...store.shoppingList, ...newItems])
    return [...store.shoppingList]
  })
}

export async function toggleShoppingListItem(itemId: string, checked: boolean) {
  return runMutatingStoreOperation((store) => {
    const index = store.shoppingList.findIndex((item) => item.id === itemId)
    if (index < 0) {
      return [...store.shoppingList]
    }

    const updatedItem: ShoppingListItem = {
      ...store.shoppingList[index],
      checked,
    }

    const nextList = [...store.shoppingList]
    nextList[index] = updatedItem

    store.shoppingList = reorderShoppingList(nextList)
    return [...store.shoppingList]
  })
}

export async function addManualShoppingItem(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    return getShoppingList()
  }

  return runMutatingStoreOperation((store) => {
    const now = nowIso()
    const newItem: ShoppingListItem = {
      id: randomUUID(),
      text: trimmed,
      checked: false,
      addedAt: now,
    }

    store.shoppingList = reorderShoppingList([...store.shoppingList, newItem])
    return [...store.shoppingList]
  })
}

export async function clearShoppingList() {
  return runMutatingStoreOperation((store) => {
    store.shoppingList = []
  })
}

export async function removeShoppingListItem(itemId: string) {
  return runMutatingStoreOperation((store) => {
    store.shoppingList = store.shoppingList.filter((item) => item.id !== itemId)
    return [...store.shoppingList]
  })
}
