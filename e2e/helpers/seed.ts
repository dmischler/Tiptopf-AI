import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const E2E_DATA_DIR = path.join(os.tmpdir(), 'tiptopf-e2e')

export const RECIPE_A_ID = '11111111-1111-4111-8111-111111111111'
export const RECIPE_B_ID = '22222222-2222-4222-8222-222222222222'
export const COLLECTION_ID = '33333333-3333-4333-8333-333333333333'

export const RECIPE_A_TITLE = 'Spaghetti Bolognese'
export const RECIPE_B_TITLE = 'Apfelkuchen'
export const COLLECTION_NAME = 'Sonntagsessen'

const NOW = '2026-01-15T12:00:00.000Z'
const EARLIER = '2026-01-10T12:00:00.000Z'

export function createSeedStore() {
  return {
    schema_version: 3,
    recipes: [
      {
        id: RECIPE_A_ID,
        title: RECIPE_A_TITLE,
        ingredients: ['500 g Hackfleisch', '1 Zwiebel'],
        instructions: 'Anbraten\nKöcheln lassen',
        prep_time: 15,
        cook_time: 40,
        servings: 4,
        category: 'main',
        difficulty: 'medium',
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
      {
        id: RECIPE_B_ID,
        title: RECIPE_B_TITLE,
        ingredients: ['200 g Mehl', '3 Äpfel'],
        instructions: 'Teig rühren\nBacken',
        prep_time: 20,
        cook_time: 45,
        servings: 8,
        category: 'dessert',
        difficulty: 'easy',
        rating: null,
        is_favorite: false,
        image_url: null,
        source_url: null,
        source_type: 'manual',
        tags: [],
        notes: '',
        created_at: EARLIER,
        updated_at: EARLIER,
      },
    ],
    collections: [
      {
        id: COLLECTION_ID,
        name: COLLECTION_NAME,
        recipe_ids: [RECIPE_A_ID],
        created_at: NOW,
        updated_at: NOW,
      },
    ],
    shoppingList: [],
    settings: {
      opencode_api_key: null,
      opencode_base_url: null,
      opencode_model_id: null,
      gemini_api_key: null,
      gemini_base_url: null,
      gemini_model_id: null,
      gemini_fallback_model_id: null,
      pexels_api_key: null,
    },
  }
}

export function writeSeedStore(dataDir = E2E_DATA_DIR) {
  mkdirSync(path.join(dataDir, 'recipe-images'), { recursive: true })
  writeFileSync(path.join(dataDir, 'tiptopf.json'), `${JSON.stringify(createSeedStore(), null, 2)}\n`)
}
