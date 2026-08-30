import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type {
  AppSettings,
  Collection,
  Difficulty,
  Recipe,
  RecipeCategory,
  RecipeSourceType,
  ShoppingListItem,
} from '@/types'

import { writeFileDurable } from '@/lib/local/durable-write'
import { StoreCorruptError } from '@/lib/local/errors'
import {
  migrateRecipeImageFile,
  purgeAllTrashedRecipeImages,
  trashRecipeImages,
} from '@/lib/local/images'
import { getStoreFilePath } from '@/lib/local/paths'
import { canonicalRecipeImageUrl, parseApiImageFileName } from '@/lib/recipe-image'
import { reorderShoppingList } from '@/lib/shopping'
import { normalizeTags } from '@/lib/utils'

export const CURRENT_SCHEMA_VERSION = 3
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LocalStore = {
  schema_version: number
  recipes: Recipe[]
  collections: Collection[]
  shoppingList: ShoppingListItem[]
  settings: AppSettings
}

export type RecipePatch = Partial<Omit<Recipe, 'id' | 'created_at'>>

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

type UpdateRecipeInput = RecipePatch

type CreateRecipeOptions = {
  id?: string
  createdAt?: string
  index?: number
}

type UpsertRecipeOptions = {
  index?: number
}

let writeQueue: Promise<void> = Promise.resolve()
// Prevents first-boot ENOENT from re-entering the queue while a mutation is running.
let mutationRunning = false
let trashPurgedThisProcess = false

function nowIso() {
  return new Date().toISOString()
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
    schema_version: CURRENT_SCHEMA_VERSION,
    recipes: [],
    collections: [],
    shoppingList: [],
    settings: createDefaultSettings(),
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function sanitizeStoredImageUrl(value: unknown): string | null {
  const fileName = parseApiImageFileName(typeof value === 'string' ? value : null)
  if (!fileName) {
    return null
  }

  return `/api/images/${fileName}`
}

function uniqueIds(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (seen.has(value)) {
      continue
    }
    seen.add(value)
    result.push(value)
  }

  return result
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

  // Older schema versions stored user_id; ignore it. Writes omit it.
  return {
    id,
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
    image_url: sanitizeStoredImageUrl(value.image_url),
    source_url: toStringOrNull(value.source_url),
    source_type: normalizeSourceType(value.source_type),
    tags,
    notes: typeof value.notes === 'string' ? value.notes : '',
    created_at: createdAt,
    updated_at: updatedAt,
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

  const recipeIds = uniqueIds(
    Array.isArray(value.recipe_ids)
      ? value.recipe_ids.map((item) => String(item)).filter((item) => item.trim().length > 0)
      : []
  )

  return {
    id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Unnamed Collection',
    recipe_ids: recipeIds,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

// Shopping list items are camelCase on disk (addedAt, sourceRecipeTitle, sourceServings).
// Older backups may still use snake_case; this reads both and always writes camelCase.
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

function normalizeSchemaVersion(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value))
  }

  return 1
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
    schema_version: normalizeSchemaVersion(value.schema_version),
    recipes,
    collections,
    shoppingList,
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

async function chmodStoreFileBestEffort(filePath: string) {
  try {
    await fs.chmod(filePath, 0o600)
  } catch {
    // Ignore on filesystems that do not support POSIX modes.
  }
}

async function writeStore(store: LocalStore) {
  const targetPath = getStoreFilePath()
  await snapshotLastGoodStore(targetPath)
  await writeFileDurable(targetPath, JSON.stringify(store, null, 2))
  await chmodStoreFileBestEffort(targetPath)
  await chmodStoreFileBestEffort(`${targetPath}.bak`)
}

async function runBootImageMaintenance() {
  if (trashPurgedThisProcess) {
    return
  }

  trashPurgedThisProcess = true
  try {
    await purgeAllTrashedRecipeImages()
  } catch (error) {
    console.error('Failed to purge leftover recipe image trash:', error)
  }
}

async function migrateStoreMedia(store: LocalStore) {
  for (let index = 0; index < store.recipes.length; index += 1) {
    const recipe = store.recipes[index]
    const fileName = parseApiImageFileName(recipe.image_url)
    if (!fileName) {
      if (recipe.image_url) {
        store.recipes[index] = { ...recipe, image_url: null }
      }
      continue
    }

    if (fileName === `${recipe.id}.webp`) {
      const canonicalUrl = canonicalRecipeImageUrl(recipe.id)
      if (recipe.image_url !== canonicalUrl) {
        store.recipes[index] = { ...recipe, image_url: canonicalUrl }
      }
      continue
    }

    try {
      const nextUrl = await migrateRecipeImageFile(recipe)
      store.recipes[index] = { ...recipe, image_url: nextUrl }
    } catch (error) {
      console.error('Failed to migrate recipe image', recipe.id, error)
    }
  }
}

async function ensureStoreSchema(store: LocalStore) {
  if (store.schema_version >= CURRENT_SCHEMA_VERSION) {
    return
  }

  if (store.schema_version < 2) {
    await migrateStoreMedia(store)
  }

  store.schema_version = CURRENT_SCHEMA_VERSION
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
      await runBootImageMaintenance()
      const store = await readStore()
      await ensureStoreSchema(store)
      const result = await operation(store)
      await ensureStoreSchema(store)
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

async function ensureStoreReady() {
  await runBootImageMaintenance()
  const store = await readStore()
  if (store.schema_version < CURRENT_SCHEMA_VERSION) {
    await runMutatingStoreOperation(() => undefined)
  }
}

async function loadStore() {
  await ensureStoreReady()
  return readStore()
}

export async function listRecipes() {
  const store = await loadStore()
  return [...store.recipes]
}

export async function getRecipe(recipeId: string) {
  const store = await loadStore()
  return store.recipes.find((recipe) => recipe.id === recipeId) ?? null
}

function findRecipeIndex(recipes: Recipe[], recipeId: string) {
  return recipes.findIndex((recipe) => recipe.id === recipeId)
}

function insertRecipeAt(recipes: Recipe[], recipe: Recipe, index: number | undefined) {
  if (typeof index === 'number' && Number.isFinite(index) && index >= 0) {
    recipes.splice(Math.min(Math.trunc(index), recipes.length), 0, recipe)
    return
  }

  recipes.unshift(recipe)
}

function applyRecipePatchAtIndex(store: LocalStore, index: number, patch: RecipePatch): Recipe {
  const current = store.recipes[index]
  const updated: Recipe = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    updated_at: nowIso(),
  }

  if (patch.tags !== undefined) {
    updated.tags = normalizeTags(patch.tags)
  }

  if (patch.image_url !== undefined) {
    updated.image_url = sanitizeStoredImageUrl(patch.image_url)
  }

  store.recipes[index] = updated
  return updated
}

export async function patchRecipe(recipeId: string, patch: RecipePatch): Promise<Recipe> {
  return runMutatingStoreOperation((store) => {
    const index = findRecipeIndex(store.recipes, recipeId)
    if (index < 0) {
      throw new Error('Recipe not found')
    }

    return applyRecipePatchAtIndex(store, index, patch)
  })
}

export async function createRecipe(input: CreateRecipeInput, options?: CreateRecipeOptions) {
  return runMutatingStoreOperation((store) => {
    const now = nowIso()
    const id = isUuid(options?.id) ? options.id : randomUUID()
    if (findRecipeIndex(store.recipes, id) >= 0) {
      throw new Error('Recipe already exists')
    }

    const createdAt =
      typeof options?.createdAt === 'string' && !Number.isNaN(new Date(options.createdAt).getTime())
        ? options.createdAt
        : now
    const canonicalUrl = canonicalRecipeImageUrl(id)

    const recipe: Recipe = {
      id,
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
      image_url: input.image_url === canonicalUrl ? canonicalUrl : null,
      source_url: input.source_url,
      source_type: input.source_type,
      tags: normalizeTags(input.tags),
      notes: input.notes ?? '',
      created_at: createdAt,
      updated_at: now,
    }

    insertRecipeAt(store.recipes, recipe, options?.index)
    return recipe
  })
}

export async function upsertRecipe(recipe: Recipe, options?: UpsertRecipeOptions): Promise<Recipe> {
  return runMutatingStoreOperation((store) => {
    const now = nowIso()
    if (!isUuid(recipe.id)) {
      throw new Error('Recipe id must be a UUID')
    }

    const createdAt =
      typeof recipe.created_at === 'string' && !Number.isNaN(new Date(recipe.created_at).getTime())
        ? recipe.created_at
        : now
    const updatedAt =
      typeof recipe.updated_at === 'string' && !Number.isNaN(new Date(recipe.updated_at).getTime())
        ? recipe.updated_at
        : now

    const next: Recipe = {
      id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      servings: recipe.servings,
      category: recipe.category,
      difficulty: recipe.difficulty,
      rating: recipe.rating,
      is_favorite: recipe.is_favorite,
      image_url: sanitizeStoredImageUrl(recipe.image_url),
      source_url: recipe.source_url,
      source_type: recipe.source_type,
      tags: normalizeTags(recipe.tags),
      notes: recipe.notes ?? '',
      created_at: createdAt,
      updated_at: updatedAt,
    }

    const index = findRecipeIndex(store.recipes, next.id)
    if (index >= 0) {
      next.created_at = recipe.created_at ? createdAt : store.recipes[index].created_at
      store.recipes[index] = next
      return next
    }

    insertRecipeAt(store.recipes, next, options?.index)
    return next
  })
}

export async function updateRecipe(recipeId: string, input: UpdateRecipeInput) {
  return patchRecipe(recipeId, input)
}

export async function deleteRecipe(recipeId: string) {
  const removed = await runMutatingStoreOperation((store) => {
    const index = findRecipeIndex(store.recipes, recipeId)
    if (index < 0) {
      throw new Error('Recipe not found')
    }

    const [removedRecipe] = store.recipes.splice(index, 1)
    const now = nowIso()
    store.collections = store.collections.map((collection) => {
      const nextIds = collection.recipe_ids.filter((id) => id !== recipeId)
      if (nextIds.length === collection.recipe_ids.length) {
        return collection
      }

      return {
        ...collection,
        recipe_ids: nextIds,
        updated_at: now,
      }
    })

    return removedRecipe
  })

  try {
    await trashRecipeImages(removed)
  } catch (error) {
    console.error('Failed to trash recipe images:', error)
  }

  return removed
}

export async function updateRecipeImage(recipeId: string, imageUrl: string | null) {
  return patchRecipe(recipeId, { image_url: imageUrl })
}

export async function updateRecipeFavorite(recipeId: string, isFavorite: boolean) {
  return runMutatingStoreOperation((store) => {
    const index = findRecipeIndex(store.recipes, recipeId)
    if (index < 0) {
      return null
    }

    return applyRecipePatchAtIndex(store, index, { is_favorite: isFavorite })
  })
}

export async function updateRecipeRating(recipeId: string, rating: number | null) {
  return runMutatingStoreOperation((store) => {
    const index = findRecipeIndex(store.recipes, recipeId)
    if (index < 0) {
      return null
    }

    return applyRecipePatchAtIndex(store, index, { rating })
  })
}

export async function getSettings() {
  const store = await loadStore()
  return { ...store.settings }
}

export async function updateSettings(input: Partial<AppSettings>) {
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

    if ('gemini_model_id' in input) {
      next.gemini_model_id = normalizeOptionalString(input.gemini_model_id)
    }

    if ('gemini_fallback_model_id' in input) {
      next.gemini_fallback_model_id = normalizeOptionalString(input.gemini_fallback_model_id)
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
  const store = await loadStore()
  return [...store.collections]
}

export async function getCollection(collectionId: string) {
  const store = await loadStore()
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
    if (findRecipeIndex(store.recipes, recipeId) < 0) {
      throw new Error('Recipe not found')
    }

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
      recipe_ids: uniqueIds([...collection.recipe_ids, recipeId]),
      updated_at: nowIso(),
    }

    store.collections[index] = updated
    return updated
  })
}

const MAX_IMPORT_JSON_CHARS = 5 * 1024 * 1024

export async function exportStoreJson(options?: { includeSecrets?: boolean }): Promise<string> {
  const store = await loadStore()
  const includeSecrets = options?.includeSecrets === true
  const settings = includeSecrets
    ? store.settings
    : {
        ...store.settings,
        opencode_api_key: null,
        gemini_api_key: null,
        pexels_api_key: null,
      }

  return JSON.stringify(
    {
      schema_version: store.schema_version,
      recipes: store.recipes,
      collections: store.collections,
      shoppingList: store.shoppingList,
      settings,
    },
    null,
    2,
  )
}

function assertImportShape(value: unknown): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error('Ungültiges Store-Format.')
  }

  if (!Array.isArray(value.recipes) || !Array.isArray(value.collections)) {
    throw new Error('Store muss Rezepte und Sammlungen enthalten.')
  }
}

export async function importStoreJson(raw: string, options?: { includeSecrets?: boolean }) {
  if (raw.length > MAX_IMPORT_JSON_CHARS) {
    throw new Error('Backup ist zu groß (max. 5 MB).')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Ungültiges JSON Format.')
  }

  assertImportShape(parsed)
  const incoming = normalizeStore(parsed)
  const includeSecrets = options?.includeSecrets === true

  return runMutatingStoreOperation((store) => {
    const existingSettings = store.settings
    store.schema_version = incoming.schema_version
    store.recipes = incoming.recipes
    store.collections = incoming.collections
    store.shoppingList = incoming.shoppingList
    store.settings = {
      ...incoming.settings,
      opencode_api_key: includeSecrets ? incoming.settings.opencode_api_key : existingSettings.opencode_api_key,
      gemini_api_key: includeSecrets ? incoming.settings.gemini_api_key : existingSettings.gemini_api_key,
      pexels_api_key: includeSecrets ? incoming.settings.pexels_api_key : existingSettings.pexels_api_key,
    }
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
  const store = await loadStore()
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
    return [...store.shoppingList]
  })
}

export async function removeShoppingListItem(itemId: string) {
  return runMutatingStoreOperation((store) => {
    store.shoppingList = store.shoppingList.filter((item) => item.id !== itemId)
    return [...store.shoppingList]
  })
}
