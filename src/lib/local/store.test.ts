import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { StoreCorruptError } from '@/lib/local/errors'
import { storedRecipeImageUrlSchema } from '@/lib/recipe-schema'
import type { Recipe } from '@/types'

const NOW = '2026-01-01T12:00:00.000Z'
const IMPORTED_RECIPE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const IMPORTED_COLLECTION_ID = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'

type StoreModule = typeof import('@/lib/local/store')

let dataDir: string
let store: StoreModule

function recipeInput(overrides: Partial<Parameters<StoreModule['createRecipe']>[0]> = {}) {
  return {
    title: 'Test Recipe',
    ingredients: ['1 Ei'],
    instructions: 'Kochen',
    prep_time: 5,
    cook_time: 10,
    servings: 2,
    category: 'main' as const,
    difficulty: 'easy' as const,
    image_url: null,
    source_url: null,
    source_type: 'manual' as const,
    tags: [],
    notes: '',
    ...overrides,
  }
}

function importedStoreJson() {
  return JSON.stringify({
    schema_version: 3,
    recipes: [
      {
        id: IMPORTED_RECIPE_ID,
        title: 'Imported Recipe',
        ingredients: ['1 g Salz'],
        instructions: 'Mischen',
        prep_time: 1,
        cook_time: 1,
        servings: 1,
        category: 'main',
        difficulty: 'easy',
        rating: null,
        is_favorite: false,
        image_url: null,
        source_url: null,
        source_type: 'manual',
        tags: [],
        notes: '',
        created_at: NOW,
        updated_at: NOW,
      },
    ],
    collections: [
      {
        id: IMPORTED_COLLECTION_ID,
        name: 'Imported Collection',
        recipe_ids: [IMPORTED_RECIPE_ID],
        created_at: NOW,
        updated_at: NOW,
      },
    ],
    shoppingList: [],
    settings: {},
  })
}

function isEmptyDefaultStore(value: unknown) {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.recipes) &&
    record.recipes.length === 0 &&
    Array.isArray(record.collections) &&
    record.collections.length === 0 &&
    Array.isArray(record.shoppingList) &&
    record.shoppingList.length === 0
  )
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'tiptopf-store-'))
  process.env.DATA_DIR = dataDir
  await mkdir(path.join(dataDir, 'recipe-images'), { recursive: true })
  store = await import('@/lib/local/store')
})

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

describe('store identity and durability', () => {
  it('preserves id across create + delete + upsert and prunes collections on delete', async () => {
    const created = await store.createRecipe(recipeInput({ title: 'Keep my id' }))
    const collection = await store.createCollection('Dinner')
    await store.addRecipeToCollection(collection.id, created.id)

    const removed = await store.deleteRecipe(created.id)
    expect(removed.id).toBe(created.id)

    const collectionsAfterDelete = await store.listCollections()
    expect(collectionsAfterDelete).toHaveLength(1)
    expect(collectionsAfterDelete[0].recipe_ids).not.toContain(created.id)

    const restored = await store.upsertRecipe(removed)
    expect(restored.id).toBe(created.id)

    const loaded = await store.getRecipe(created.id)
    expect(loaded?.id).toBe(created.id)
    expect(loaded?.title).toBe('Keep my id')
  })

  it('serializes import while a queued create is in flight (no lost update)', async () => {
    const createPromise = store.createRecipe(recipeInput({ title: 'Created In Flight' }))
    const importPromise = store.importStoreJson(importedStoreJson())

    const results = await Promise.allSettled([createPromise, importPromise])
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true)

    const recipes = await store.listRecipes()
    const titles = recipes.map((recipe) => recipe.title)
    expect(titles).toContain('Imported Recipe')

    const collections = await store.listCollections()
    expect(collections.some((collection) => collection.name === 'Imported Collection')).toBe(true)
  })

  it('throws StoreCorruptError on corrupt JSON and does not replace the file with an empty default', async () => {
    const storePath = path.join(dataDir, 'tiptopf.json')
    const corrupt = '{not-json'
    await writeFile(storePath, corrupt, 'utf8')

    await expect(store.listRecipes()).rejects.toBeInstanceOf(StoreCorruptError)

    let live: string | null = null
    try {
      live = await readFile(storePath, 'utf8')
    } catch {
      live = null
    }

    if (live !== null) {
      try {
        const parsed: unknown = JSON.parse(live)
        expect(isEmptyDefaultStore(parsed)).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(SyntaxError)
      }
    }
  })

  it('rejects data:image URLs at the save schema and does not persist them', async () => {
    const parsed = storedRecipeImageUrlSchema.safeParse('data:image/png;base64,xx')
    expect(parsed.success).toBe(false)

    const created = await store.createRecipe(recipeInput({ title: 'No data url' }))
    const withDataUrl: Recipe = {
      ...created,
      image_url: 'data:image/png;base64,xx',
    }

    const saved = await store.upsertRecipe(withDataUrl)
    expect(saved.id).toBe(created.id)
    expect(saved.image_url).toBeNull()
  })

  it('removes the recipe id from collection recipe_ids on delete', async () => {
    const created = await store.createRecipe(recipeInput({ title: 'Cascade me' }))
    const collection = await store.createCollection('Weeknight')
    await store.addRecipeToCollection(collection.id, created.id)

    await store.deleteRecipe(created.id)

    const after = await store.getCollection(collection.id)
    expect(after?.recipe_ids).not.toContain(created.id)
  })

  it('strips API keys from the default backup export', async () => {
    await store.updateSettings({
      opencode_api_key: 'secret-opencode',
      gemini_api_key: 'secret-gemini',
      pexels_api_key: 'secret-pexels',
    })

    const stripped = JSON.parse(await store.exportStoreJson()) as {
      settings: { opencode_api_key: string | null; gemini_api_key: string | null; pexels_api_key: string | null }
    }
    expect(stripped.settings.opencode_api_key).toBeNull()
    expect(stripped.settings.gemini_api_key).toBeNull()
    expect(stripped.settings.pexels_api_key).toBeNull()

    const withKeys = JSON.parse(await store.exportStoreJson({ includeSecrets: true })) as {
      settings: { opencode_api_key: string | null }
    }
    expect(withKeys.settings.opencode_api_key).toBe('secret-opencode')
  })
})
